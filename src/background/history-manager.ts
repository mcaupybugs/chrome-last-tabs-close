import type { ClosedTabEntry } from "../shared/types";

const STORAGE_KEY = "closedTabsHistory";
const MAX_ENTRIES = 100;
const MAX_AGE_MS = 7_200_000; // 2 hours

export class HistoryManager {
  private entries: ClosedTabEntry[] = [];

  async init(): Promise<void> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    this.entries = (result[STORAGE_KEY] as ClosedTabEntry[] | undefined) ?? [];
    await this.pruneOld();
  }

  async addEntry(entry: ClosedTabEntry): Promise<void> {
    this.entries.unshift(entry);
    await this.pruneOld();
    await this.persist();
  }

  async getHistory(): Promise<ClosedTabEntry[]> {
    return [...this.entries];
  }

  async restoreTab(url: string): Promise<void> {
    await chrome.tabs.create({ url });
    this.entries = this.entries.filter((e) => e.url !== url);
    await this.persist();
  }

  async pruneOld(): Promise<void> {
    const cutoff = Date.now() - MAX_AGE_MS;
    this.entries = this.entries
      .filter((e) => e.closedAt >= cutoff)
      .slice(0, MAX_ENTRIES);
    await this.persist();
  }

  async clear(): Promise<void> {
    this.entries = [];
    await this.persist();
  }

  private async persist(): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: this.entries });
  }
}
