export type MessageType =
  | "START_COUNTDOWN"
  | "CANCEL_COUNTDOWN"
  | "UPDATE_COUNTDOWN_PROGRESS"
  | "RESTORE_FAVICON"
  | "GET_STATUS"
  | "STATUS_RESPONSE"
  | "GET_HISTORY"
  | "HISTORY_RESPONSE"
  | "RESTORE_TAB"
  | "TOGGLE_ENABLED"
  | "SETTINGS_UPDATED";

export interface StartCountdownMessage {
  type: "START_COUNTDOWN";
  tabId: number;
  duration: number; // seconds
}

export interface CancelCountdownMessage {
  type: "CANCEL_COUNTDOWN";
  tabId: number;
}

export interface UpdateCountdownProgressMessage {
  type: "UPDATE_COUNTDOWN_PROGRESS";
  progress: number; // 0-1
}

export interface RestoreFaviconMessage {
  type: "RESTORE_FAVICON";
}

export interface GetStatusMessage {
  type: "GET_STATUS";
}

export interface StatusResponseMessage {
  type: "STATUS_RESPONSE";
  enabled: boolean;
  totalTabs: number;
  inactiveTabs: number;
  countdownTabs: { tabId: number; url: string; title: string; endsAt: number }[];
}

export interface GetHistoryMessage {
  type: "GET_HISTORY";
}

export interface HistoryResponseMessage {
  type: "HISTORY_RESPONSE";
  entries: { url: string; title: string; faviconUrl: string; closedAt: number }[];
}

export interface RestoreTabMessage {
  type: "RESTORE_TAB";
  url: string;
}

export interface ToggleEnabledMessage {
  type: "TOGGLE_ENABLED";
  enabled: boolean;
}

export interface SettingsUpdatedMessage {
  type: "SETTINGS_UPDATED";
}

export type ExtensionMessage =
  | StartCountdownMessage
  | CancelCountdownMessage
  | UpdateCountdownProgressMessage
  | RestoreFaviconMessage
  | GetStatusMessage
  | StatusResponseMessage
  | GetHistoryMessage
  | HistoryResponseMessage
  | RestoreTabMessage
  | ToggleEnabledMessage
  | SettingsUpdatedMessage;
