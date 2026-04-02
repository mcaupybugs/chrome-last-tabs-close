import { getSettings, type Settings } from "../shared/settings.js";
import type { TabTracker } from "./tab-tracker.js";

export class RulesEngine {
  private tracker: TabTracker;

  constructor(tracker: TabTracker) {
    this.tracker = tracker;
  }

  async evaluate(): Promise<number[]> {
    const settings = await getSettings();

    if (!settings.enabled) return [];

    const allTabs = await chrome.tabs.query({});
    const tabsToClose = new Set<number>();

    // Get exempt tab IDs (pinned + whitelisted domains)
    const exemptIds = new Set<number>();
    for (const tab of allTabs) {
      if (!tab.id) continue;
      if (tab.pinned) {
        exemptIds.add(tab.id);
        continue;
      }
      if (tab.url && this.isDomainWhitelisted(tab.url, settings.whitelistedDomains)) {
        exemptIds.add(tab.id);
      }
    }

    const eligibleTabs = allTabs.filter((t) => t.id != null && !exemptIds.has(t.id));

    // Rule 1: Inactivity timeout
    if (settings.enableInactivityRule) {
      const thresholdMs = settings.inactivityTimeout * 60 * 1000;
      const inactiveTabs = this.tracker.getInactiveTabs(thresholdMs);
      for (const tabId of inactiveTabs) {
        if (!exemptIds.has(tabId)) {
          tabsToClose.add(tabId);
        }
      }
    }

    // Rule 2: Max tab count (close least recently used to get back to limit)
    if (settings.enableMaxTabsRule && eligibleTabs.length > settings.maxTabs) {
      const excess = eligibleTabs.length - settings.maxTabs;
      const sorted = eligibleTabs
        .filter((t) => t.id != null)
        .map((t) => ({
          tabId: t.id!,
          lastAccessed: this.tracker.getLastAccessed(t.id!) ?? 0,
        }))
        .sort((a, b) => a.lastAccessed - b.lastAccessed);

      for (let i = 0; i < excess && i < sorted.length; i++) {
        tabsToClose.add(sorted[i].tabId);
      }
    }

    // Never close the currently active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      tabsToClose.delete(activeTab.id);
    }

    return Array.from(tabsToClose);
  }

  private isDomainWhitelisted(url: string, whitelist: string[]): boolean {
    if (whitelist.length === 0) return false;
    try {
      const hostname = new URL(url).hostname;
      return whitelist.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  async getStats(): Promise<{ totalTabs: number; inactiveTabs: number }> {
    const settings = await getSettings();
    const allTabs = await chrome.tabs.query({});
    const thresholdMs = settings.inactivityTimeout * 60 * 1000;
    const inactiveTabs = this.tracker.getInactiveTabs(thresholdMs);
    return {
      totalTabs: allTabs.length,
      inactiveTabs: inactiveTabs.length,
    };
  }
}
