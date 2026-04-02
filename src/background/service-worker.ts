import { TabTracker } from "./tab-tracker.js";
import { RulesEngine } from "./rules-engine.js";
import { CountdownManager } from "./countdown-manager.js";
import { HistoryManager } from "./history-manager.js";
import { getSettings, saveSettings, onSettingsChanged } from "../shared/settings.js";
import type { ExtensionMessage } from "../shared/messages.js";
import type { ClosedTabEntry } from "../shared/types.js";

const CHECK_ALARM = "check-tabs";
const CHECK_INTERVAL_MIN = 1;

const tracker = new TabTracker();
const rulesEngine = new RulesEngine(tracker);
const countdownManager = new CountdownManager();
const historyManager = new HistoryManager();

async function initialize(): Promise<void> {
  await tracker.init();
  await countdownManager.init();
  await historyManager.init();

  const settings = await getSettings();
  countdownManager.setDuration(settings.countdownDuration);

  // Register callback for when countdown closes a tab
  countdownManager.onClosed(async (_tabId, url, title, faviconUrl) => {
    const entry: ClosedTabEntry = { url, title, faviconUrl, closedAt: Date.now() };
    await historyManager.addEntry(entry);
  });

  // Periodic check alarm
  chrome.alarms.create(CHECK_ALARM, { periodInMinutes: CHECK_INTERVAL_MIN });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CHECK_ALARM) {
      checkAndClose();
    }
  });

  // Update countdown duration when settings change
  onSettingsChanged((newSettings) => {
    countdownManager.setDuration(newSettings.countdownDuration);
  });

  // Listen for internal messages (from countdown manager about closed tabs)
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message as ExtensionMessage & { type: string }, sendResponse);
    return true; // keep channel open for async responses
  });

  // Run initial check
  checkAndClose();
}

async function checkAndClose(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled) return;

  const tabsToClose = await rulesEngine.evaluate();

  for (const tabId of tabsToClose) {
    if (!countdownManager.isInCountdown(tabId)) {
      await countdownManager.startCountdown(tabId);
    }
  }
}

async function handleMessage(
  message: ExtensionMessage & { type: string },
  sendResponse: (response?: unknown) => void
): Promise<void> {
  switch (message.type) {
    case "GET_STATUS": {
      const settings = await getSettings();
      const stats = await rulesEngine.getStats();
      const countdowns = countdownManager.getActiveCountdowns();

      const countdownTabs: { tabId: number; url: string; title: string; endsAt: number }[] = [];
      for (const cd of countdowns) {
        try {
          const tab = await chrome.tabs.get(cd.tabId);
          countdownTabs.push({
            tabId: cd.tabId,
            url: tab.url ?? "",
            title: tab.title ?? "",
            endsAt: cd.endsAt,
          });
        } catch {
          // Tab no longer exists
        }
      }

      sendResponse({
        type: "STATUS_RESPONSE",
        enabled: settings.enabled,
        totalTabs: stats.totalTabs,
        inactiveTabs: stats.inactiveTabs,
        countdownTabs,
      });
      break;
    }

    case "GET_HISTORY": {
      const entries = await historyManager.getHistory();
      sendResponse({
        type: "HISTORY_RESPONSE",
        entries,
      });
      break;
    }

    case "RESTORE_TAB": {
      if ("url" in message) {
        await historyManager.restoreTab(message.url);
      }
      sendResponse({ success: true });
      break;
    }

    case "TOGGLE_ENABLED": {
      if ("enabled" in message) {
        await saveSettings({ enabled: message.enabled });
        if (!message.enabled) {
          // Cancel all active countdowns when disabled
          const countdowns = countdownManager.getActiveCountdowns();
          for (const cd of countdowns) {
            await countdownManager.cancelCountdown(cd.tabId);
          }
        }
      }
      sendResponse({ success: true });
      break;
    }

    case "CANCEL_COUNTDOWN": {
      if ("tabId" in message) {
        await countdownManager.cancelCountdown(message.tabId);
      }
      sendResponse({ success: true });
      break;
    }
  }
}

// Initialize on service worker start
initialize();
