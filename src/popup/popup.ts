export {}; // Mark as ES module to avoid global scope conflicts

// ── Message types (inline — popup is bundled separately) ──

interface CountdownTab {
  tabId: number;
  url: string;
  title: string;
  endsAt: number;
}

interface StatusResponse {
  type: "STATUS_RESPONSE";
  enabled: boolean;
  totalTabs: number;
  inactiveTabs: number;
  countdownTabs: CountdownTab[];
}

interface HistoryEntry {
  url: string;
  title: string;
  faviconUrl: string;
  closedAt: number;
}

interface HistoryResponse {
  type: "HISTORY_RESPONSE";
  entries: HistoryEntry[];
}

// ── DOM refs ──

const enableToggle = document.getElementById("enableToggle") as HTMLInputElement;
const statusLabel = document.getElementById("statusLabel")!;
const statsText = document.getElementById("statsText")!;
const countdownList = document.getElementById("countdownList")!;
const historyList = document.getElementById("historyList")!;
const settingsLink = document.getElementById("settingsLink")!;

// ── Helpers ──

function formatRemaining(endsAt: number): { text: string; urgent: boolean } {
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  if (remaining <= 0) return { text: "closing…", urgent: true };
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return {
    text: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
    urgent: remaining <= 30,
  };
}

function timeAgo(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function faviconUrl(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?sz=32&domain=${u.hostname}`;
  } catch {
    return "";
  }
}

// ── Rendering ──

function renderCountdown(tabs: CountdownTab[]): void {
  if (tabs.length === 0) {
    countdownList.innerHTML = `<li class="empty-state">No tabs in countdown</li>`;
    return;
  }

  countdownList.innerHTML = tabs
    .map((tab) => {
      const { text, urgent } = formatRemaining(tab.endsAt);
      const icon = faviconUrl(tab.url);
      return `
        <li class="list-item" data-tab-id="${tab.tabId}">
          <img class="item-favicon" src="${icon}" alt="" />
          <div class="item-info">
            <div class="item-title">${truncate(tab.title || tab.url, 40)}</div>
            <div class="item-meta${urgent ? " urgent" : ""}">${text}</div>
          </div>
          <button class="btn btn-save" data-action="cancel" data-tab-id="${tab.tabId}">Save</button>
        </li>`;
    })
    .join("");
}

function renderHistory(entries: HistoryEntry[]): void {
  const recent = entries.slice(0, 5);
  if (recent.length === 0) {
    historyList.innerHTML = `<li class="empty-state">No recently closed tabs</li>`;
    return;
  }

  historyList.innerHTML = recent
    .map((entry) => {
      const icon = entry.faviconUrl || faviconUrl(entry.url);
      return `
        <li class="list-item">
          <img class="item-favicon" src="${icon}" alt="" />
          <div class="item-info">
            <div class="item-title">${truncate(entry.title || entry.url, 40)}</div>
            <div class="item-meta">${timeAgo(entry.closedAt)}</div>
          </div>
          <button class="btn btn-restore" data-action="restore" data-url="${entry.url}">Restore</button>
        </li>`;
    })
    .join("");
}

function updateToggleUI(enabled: boolean): void {
  enableToggle.checked = enabled;
  statusLabel.textContent = enabled ? "Active" : "Paused";
  statusLabel.className = `status-label ${enabled ? "active" : "paused"}`;
}

// ── Data fetching ──

async function fetchStatus(): Promise<void> {
  try {
    const res: StatusResponse = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (!res || res.type !== "STATUS_RESPONSE") return;

    updateToggleUI(res.enabled);
    statsText.textContent = `${res.totalTabs} tab${res.totalTabs !== 1 ? "s" : ""} open, ${res.inactiveTabs} inactive`;
    renderCountdown(res.countdownTabs);
  } catch {
    statsText.textContent = "Unable to reach background service";
  }
}

async function fetchHistory(): Promise<void> {
  try {
    const res: HistoryResponse = await chrome.runtime.sendMessage({ type: "GET_HISTORY" });
    if (!res || res.type !== "HISTORY_RESPONSE") return;
    renderHistory(res.entries);
  } catch {
    // silently ignore
  }
}

async function refresh(): Promise<void> {
  await Promise.all([fetchStatus(), fetchHistory()]);
}

// ── Event handlers ──

enableToggle.addEventListener("change", async () => {
  const enabled = enableToggle.checked;
  updateToggleUI(enabled);
  await chrome.runtime.sendMessage({ type: "TOGGLE_ENABLED", enabled });
});

document.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  if (!target.matches("[data-action]")) return;

  const action = target.dataset.action;

  if (action === "cancel") {
    const tabId = Number(target.dataset.tabId);
    await chrome.runtime.sendMessage({ type: "CANCEL_COUNTDOWN", tabId });
    await fetchStatus();
  }

  if (action === "restore") {
    const url = target.dataset.url;
    if (url) {
      await chrome.runtime.sendMessage({ type: "RESTORE_TAB", url });
      await fetchHistory();
    }
  }
});

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ── Init & auto-refresh ──

refresh();
const intervalId = setInterval(refresh, 3000);

// Clean up when popup closes
window.addEventListener("unload", () => clearInterval(intervalId));
