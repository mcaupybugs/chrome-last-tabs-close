export interface TabInfo {
  tabId: number;
  url: string;
  title: string;
  lastAccessed: number;
  windowId: number;
}

export interface ClosedTabEntry {
  url: string;
  title: string;
  faviconUrl: string;
  closedAt: number;
}

export interface CountdownState {
  tabId: number;
  startedAt: number;
  endsAt: number;
  originalFaviconUrl: string;
}
