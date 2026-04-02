const STORAGE_KEY = 'tabAccessTimes';
const PERSIST_DEBOUNCE_MS = 5000;

export class TabTracker {
  private accessTimes: Map<number, number> = new Map();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPending = false;

  async init(): Promise<void> {
    await this.loadFromStorage();
    await this.reconcileWithOpenTabs();
    this.setupListeners();
  }

  getLastAccessed(tabId: number): number | undefined {
    return this.accessTimes.get(tabId);
  }

  getAllTrackedTabs(): Map<number, number> {
    return new Map(this.accessTimes);
  }

  markAccessed(tabId: number): void {
    this.accessTimes.set(tabId, Date.now());
    this.debouncedPersist();
  }

  getInactiveTabs(thresholdMs: number): number[] {
    const cutoff = Date.now() - thresholdMs;
    const result: number[] = [];
    for (const [tabId, timestamp] of this.accessTimes) {
      if (timestamp < cutoff) {
        result.push(tabId);
      }
    }
    return result;
  }

  // --- Private helpers ---

  private async loadFromStorage(): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const stored = data[STORAGE_KEY] as Record<string, number> | undefined;
    if (stored) {
      for (const [id, ts] of Object.entries(stored)) {
        this.accessTimes.set(Number(id), ts);
      }
    }
  }

  private async reconcileWithOpenTabs(): Promise<void> {
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map((t) => t.id!));

    // Remove tracked tabs that no longer exist
    for (const tabId of this.accessTimes.keys()) {
      if (!openTabIds.has(tabId)) {
        this.accessTimes.delete(tabId);
      }
    }

    // Add any open tabs we aren't tracking yet
    const now = Date.now();
    for (const tab of openTabs) {
      if (tab.id != null && !this.accessTimes.has(tab.id)) {
        this.accessTimes.set(tab.id, tab.lastAccessed ?? now);
      }
    }

    await this.persist();
  }

  private setupListeners(): void {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.markAccessed(activeInfo.tabId);
    });

    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.id != null) {
        this.markAccessed(tab.id);
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.accessTimes.delete(tabId);
      this.debouncedPersist();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'complete') {
        this.markAccessed(tabId);
      }
    });
  }

  private debouncedPersist(): void {
    this.persistPending = true;
    if (this.persistTimer != null) return;

    this.persistTimer = setTimeout(async () => {
      this.persistTimer = null;
      if (this.persistPending) {
        this.persistPending = false;
        await this.persist();
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  private async persist(): Promise<void> {
    const obj: Record<string, number> = {};
    for (const [id, ts] of this.accessTimes) {
      obj[String(id)] = ts;
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: obj });
  }
}
