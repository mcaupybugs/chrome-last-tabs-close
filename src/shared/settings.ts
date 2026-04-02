export interface Settings {
  enabled: boolean;
  inactivityTimeout: number; // minutes
  maxTabs: number;
  countdownDuration: number; // seconds
  whitelistedDomains: string[];
  enableInactivityRule: boolean;
  enableMaxTabsRule: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  inactivityTimeout: 30,
  maxTabs: 20,
  countdownDuration: 60,
  whitelistedDomains: [],
  enableInactivityRule: true,
  enableMaxTabsRule: true,
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get("settings");
  return { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
}

export async function saveSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.sync.set({ settings: updated });
  return updated;
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      const newSettings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue as Partial<Settings>) };
      callback(newSettings);
    }
  });
}
