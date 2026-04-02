export {}; // Mark as ES module to avoid global scope conflicts

type ChromeApi = typeof chrome;

function getChrome(): ChromeApi | null {
  return typeof chrome === "undefined" ? null : chrome;
}

interface Settings {
  enabled: boolean;
  inactivityTimeout: number;
  maxTabs: number;
  countdownDuration: number;
  whitelistedDomains: string[];
  enableInactivityRule: boolean;
  enableMaxTabsRule: boolean;
}

interface HistoryEntry {
  url: string;
  title: string;
  faviconUrl: string;
  closedAt: number;
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  inactivityTimeout: 30,
  maxTabs: 20,
  countdownDuration: 60,
  whitelistedDomains: [],
  enableInactivityRule: true,
  enableMaxTabsRule: true,
};

// ── DOM refs ──────────────────────────────────────────────

const $inactivityToggle = document.getElementById(
  "enableInactivityRule",
) as HTMLInputElement;
const $inactivityTimeout = document.getElementById(
  "inactivityTimeout",
) as HTMLInputElement;
const $inactivityValue = document.getElementById(
  "inactivityValue",
) as HTMLElement;
const $inactivityBody = document.getElementById(
  "inactivityRuleBody",
) as HTMLElement;

const $maxTabsToggle = document.getElementById(
  "enableMaxTabsRule",
) as HTMLInputElement;
const $maxTabs = document.getElementById("maxTabs") as HTMLInputElement;
const $maxTabsBody = document.getElementById("maxTabsRuleBody") as HTMLElement;

const $countdownDuration = document.getElementById(
  "countdownDuration",
) as HTMLInputElement;
const $countdownValue = document.getElementById(
  "countdownValue",
) as HTMLElement;

const $domainInput = document.getElementById("domainInput") as HTMLInputElement;
const $addDomainBtn = document.getElementById(
  "addDomainBtn",
) as HTMLButtonElement;
const $domainList = document.getElementById("domainList") as HTMLUListElement;

const $historyList = document.getElementById("historyList") as HTMLUListElement;
const $clearHistoryBtn = document.getElementById(
  "clearHistoryBtn",
) as HTMLButtonElement;

const $toast = document.getElementById("toast") as HTMLElement;

// ── State ─────────────────────────────────────────────────

let currentSettings: Settings = { ...DEFAULT_SETTINGS };
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// ── Persistence ───────────────────────────────────────────

async function loadSettings(): Promise<Settings> {
  const chromeApi = getChrome();
  if (!chromeApi?.storage?.sync) {
    return { ...DEFAULT_SETTINGS };
  }

  const result = await chromeApi.storage.sync.get("settings");
  return { ...DEFAULT_SETTINGS, ...(result.settings ?? {}) };
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const chromeApi = getChrome();
    if (chromeApi?.storage?.sync) {
      await chromeApi.storage.sync.set({ settings: currentSettings });
    }
    showToast();
  }, 300);
}

// ── Toast ─────────────────────────────────────────────────

function showToast(): void {
  if (toastTimer) clearTimeout(toastTimer);
  $toast.classList.add("visible");
  toastTimer = setTimeout(() => $toast.classList.remove("visible"), 1500);
}

// ── Populate UI from settings ─────────────────────────────

function populateUI(s: Settings): void {
  $inactivityToggle.checked = s.enableInactivityRule;
  $inactivityTimeout.value = String(s.inactivityTimeout);
  $inactivityValue.textContent = String(s.inactivityTimeout);
  updateRuleBodyState($inactivityBody, s.enableInactivityRule);

  $maxTabsToggle.checked = s.enableMaxTabsRule;
  $maxTabs.value = String(s.maxTabs);
  updateRuleBodyState($maxTabsBody, s.enableMaxTabsRule);

  $countdownDuration.value = String(s.countdownDuration);
  $countdownValue.textContent = String(s.countdownDuration);

  renderDomains(s.whitelistedDomains);
}

function updateRuleBodyState(body: HTMLElement, enabled: boolean): void {
  body.classList.toggle("disabled", !enabled);
}

// ── Domain list rendering ─────────────────────────────────

function renderDomains(domains: string[]): void {
  $domainList.innerHTML = "";
  for (const domain of domains) {
    const li = document.createElement("li");
    li.className = "domain-chip";
    li.innerHTML = `
      <span>${escapeHtml(domain)}</span>
      <button class="remove-btn" data-domain="${escapeHtml(domain)}" title="Remove">&times;</button>
    `;
    $domainList.appendChild(li);
  }
}

function addDomain(): void {
  const raw = $domainInput.value.trim().toLowerCase();
  if (!raw || currentSettings.whitelistedDomains.includes(raw)) {
    $domainInput.value = "";
    return;
  }
  currentSettings.whitelistedDomains.push(raw);
  $domainInput.value = "";
  renderDomains(currentSettings.whitelistedDomains);
  scheduleSave();
}

function removeDomain(domain: string): void {
  currentSettings.whitelistedDomains =
    currentSettings.whitelistedDomains.filter((d) => d !== domain);
  renderDomains(currentSettings.whitelistedDomains);
  scheduleSave();
}

// ── History ───────────────────────────────────────────────

async function loadHistory(): Promise<void> {
  try {
    const chromeApi = getChrome();
    if (!chromeApi?.runtime?.sendMessage) {
      renderHistory([]);
      return;
    }

    const response = await chromeApi.runtime.sendMessage({
      type: "GET_HISTORY",
    });
    if (response?.type === "HISTORY_RESPONSE") {
      renderHistory(response.entries as HistoryEntry[]);
    }
  } catch {
    renderHistory([]);
  }
}

function renderHistory(entries: HistoryEntry[]): void {
  $historyList.innerHTML = "";

  if (entries.length === 0) {
    $historyList.innerHTML = '<li class="empty-state">No closed tabs yet.</li>';
    return;
  }

  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "history-item";

    const faviconSrc = entry.faviconUrl || `chrome://favicon/${entry.url}`;
    const truncatedUrl =
      entry.url.length > 60 ? entry.url.slice(0, 60) + "…" : entry.url;

    li.innerHTML = `
      <img class="favicon" src="${escapeHtml(faviconSrc)}" alt="" />
      <div class="info">
        <div class="title">${escapeHtml(entry.title || entry.url)}</div>
        <div class="url">${escapeHtml(truncatedUrl)}</div>
      </div>
      <span class="time">${relativeTime(entry.closedAt)}</span>
      <button class="btn btn-restore" data-url="${escapeHtml(entry.url)}">Restore</button>
    `;
    $historyList.appendChild(li);
  }
}

function relativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function restoreTab(url: string): Promise<void> {
  const chromeApi = getChrome();
  if (!chromeApi?.runtime?.sendMessage) return;

  await chromeApi.runtime.sendMessage({ type: "RESTORE_TAB", url });
  await loadHistory();
}

async function clearHistory(): Promise<void> {
  const chromeApi = getChrome();
  if (!chromeApi?.runtime?.sendMessage) {
    renderHistory([]);
    return;
  }

  await chromeApi.runtime.sendMessage({ type: "CLEAR_HISTORY" });
  renderHistory([]);
}

// ── Helpers ───────────────────────────────────────────────

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Event listeners ───────────────────────────────────────

$inactivityToggle.addEventListener("change", () => {
  currentSettings.enableInactivityRule = $inactivityToggle.checked;
  updateRuleBodyState($inactivityBody, $inactivityToggle.checked);
  scheduleSave();
});

$inactivityTimeout.addEventListener("input", () => {
  const val = Number($inactivityTimeout.value);
  $inactivityValue.textContent = String(val);
  currentSettings.inactivityTimeout = val;
  scheduleSave();
});

$maxTabsToggle.addEventListener("change", () => {
  currentSettings.enableMaxTabsRule = $maxTabsToggle.checked;
  updateRuleBodyState($maxTabsBody, $maxTabsToggle.checked);
  scheduleSave();
});

$maxTabs.addEventListener("input", () => {
  const val = Number($maxTabs.value);
  if (val >= 5 && val <= 100) {
    currentSettings.maxTabs = val;
    scheduleSave();
  }
});

$countdownDuration.addEventListener("input", () => {
  const val = Number($countdownDuration.value);
  $countdownValue.textContent = String(val);
  currentSettings.countdownDuration = val;
  scheduleSave();
});

$addDomainBtn.addEventListener("click", addDomain);

$domainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

$domainList.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains("remove-btn")) {
    const domain = target.dataset.domain;
    if (domain) removeDomain(domain);
  }
});

$historyList.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest(
    ".btn-restore",
  ) as HTMLElement | null;
  if (target?.dataset.url) {
    restoreTab(target.dataset.url);
  }
});

$clearHistoryBtn.addEventListener("click", clearHistory);

// ── Init ──────────────────────────────────────────────────

(async () => {
  if (!getChrome()) {
    // Useful when viewing the options page via Vite preview or a normal browser tab.
    // The UI remains usable, but settings/history persistence is disabled.
    console.warn(
      "Chrome extension APIs not available; persistence is disabled.",
    );
  }

  currentSettings = await loadSettings();
  populateUI(currentSettings);
  await loadHistory();
})();
