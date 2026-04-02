import type { CountdownState } from "../shared/types.js";

const ALARM_PREFIX = "countdown-";
const TICK_ALARM = "countdown-tick";
const TICK_INTERVAL_SEC = 3; // update every 3 seconds for smooth animation

export type TabClosedCallback = (tabId: number, url: string, title: string, faviconUrl: string) => void;

export class CountdownManager {
  private countdowns: Map<number, CountdownState> = new Map();
  private countdownDuration: number = 60; // seconds, updated from settings
  private onTabClosed: TabClosedCallback | null = null;

  onClosed(callback: TabClosedCallback): void {
    this.onTabClosed = callback;
  }

  async init(): Promise<void> {
    // Load persisted countdowns
    const result = await chrome.storage.local.get("activeCountdowns");
    if (result.activeCountdowns) {
      const entries = result.activeCountdowns as CountdownState[];
      const now = Date.now();
      for (const cd of entries) {
        if (cd.endsAt > now) {
          this.countdowns.set(cd.tabId, cd);
        }
      }
    }

    // Listen for tab activation to cancel countdowns
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (this.countdowns.has(activeInfo.tabId)) {
        this.cancelCountdown(activeInfo.tabId);
      }
    });

    // Listen for tab removal to clean up
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.countdowns.delete(tabId);
      this.persist();
    });

    // Handle alarms
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === TICK_ALARM) {
        this.tick();
      }
    });

    // Start tick alarm if there are active countdowns
    if (this.countdowns.size > 0) {
      this.startTickAlarm();
    }
  }

  setDuration(seconds: number): void {
    this.countdownDuration = seconds;
  }

  async startCountdown(tabId: number): Promise<void> {
    if (this.countdowns.has(tabId)) return;

    // Get tab info for original favicon
    let originalFaviconUrl = "";
    try {
      const tab = await chrome.tabs.get(tabId);
      originalFaviconUrl = tab.favIconUrl ?? "";
    } catch {
      return; // Tab doesn't exist
    }

    const now = Date.now();
    const state: CountdownState = {
      tabId,
      startedAt: now,
      endsAt: now + this.countdownDuration * 1000,
      originalFaviconUrl,
    };

    this.countdowns.set(tabId, state);
    await this.persist();
    this.startTickAlarm();

    // Send initial progress update to the tab
    this.sendProgressToTab(tabId, 0);
  }

  async cancelCountdown(tabId: number): Promise<void> {
    const state = this.countdowns.get(tabId);
    if (!state) return;

    this.countdowns.delete(tabId);
    await this.persist();

    // Restore favicon
    try {
      await chrome.tabs.sendMessage(tabId, { type: "RESTORE_FAVICON" });
    } catch {
      // Tab might not have content script
    }

    if (this.countdowns.size === 0) {
      chrome.alarms.clear(TICK_ALARM);
    }
  }

  isInCountdown(tabId: number): boolean {
    return this.countdowns.has(tabId);
  }

  getActiveCountdowns(): CountdownState[] {
    return Array.from(this.countdowns.values());
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const toClose: number[] = [];

    for (const [tabId, state] of this.countdowns) {
      const elapsed = now - state.startedAt;
      const total = state.endsAt - state.startedAt;
      const progress = Math.min(elapsed / total, 1);

      if (progress >= 1) {
        toClose.push(tabId);
      } else {
        this.sendProgressToTab(tabId, progress);
      }
    }

    // Close tabs whose countdown has expired
    for (const tabId of toClose) {
      const state = this.countdowns.get(tabId);
      this.countdowns.delete(tabId);

      if (state) {
        let url = "";
        let title = "";
        try {
          const tab = await chrome.tabs.get(tabId);
          url = tab.url ?? "";
          title = tab.title ?? "";
        } catch {
          // Tab may already be gone
        }

        try {
          await chrome.tabs.remove(tabId);
        } catch {
          // Tab already closed
        }

        // Notify via callback (not runtime.sendMessage — can't message yourself)
        if (this.onTabClosed) {
          this.onTabClosed(tabId, url, title, state.originalFaviconUrl);
        }
      }
    }

    await this.persist();

    if (this.countdowns.size === 0) {
      chrome.alarms.clear(TICK_ALARM);
    }
  }

  private sendProgressToTab(tabId: number, progress: number): void {
    chrome.tabs.sendMessage(tabId, {
      type: "UPDATE_COUNTDOWN_PROGRESS",
      progress,
    }).catch(() => {
      // Content script not available (e.g., chrome:// pages)
    });
  }

  private startTickAlarm(): void {
    // chrome.alarms minimum is 1 minute for periodInMinutes,
    // but we can create one-shot alarms with delayInMinutes
    // For smooth updates, we'll use a workaround: create recurring short alarms
    chrome.alarms.get(TICK_ALARM, (alarm) => {
      if (!alarm) {
        // Use minimum period (0.5 min = 30 sec in dev, 1 min in production)
        // For sub-minute updates, we'll re-create the alarm each tick
        chrome.alarms.create(TICK_ALARM, {
          delayInMinutes: TICK_INTERVAL_SEC / 60,
          periodInMinutes: TICK_INTERVAL_SEC / 60,
        });
      }
    });
  }

  private async persist(): Promise<void> {
    const entries = Array.from(this.countdowns.values());
    await chrome.storage.local.set({ activeCountdowns: entries });
  }
}
