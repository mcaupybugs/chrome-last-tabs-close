export {}; // Mark as ES module to avoid global scope conflicts

// Self-contained content script — no imports from shared modules.
// Receives messages from the background service worker to animate
// a countdown arc on the page's favicon and restore it afterward.

interface UpdateCountdownProgressMessage {
  type: "UPDATE_COUNTDOWN_PROGRESS";
  progress: number;
}

interface RestoreFaviconMessage {
  type: "RESTORE_FAVICON";
}

type FaviconMessage = UpdateCountdownProgressMessage | RestoreFaviconMessage;

const CANVAS_SIZE = 32;
const ARC_LINE_WIDTH = 4;
const ARC_RADIUS = (CANVAS_SIZE - ARC_LINE_WIDTH) / 2;
const CENTER = CANVAS_SIZE / 2;
const BG_COLOR = "#ccc";
const ARC_COLOR = "#e53935";

let originalFaviconUrl: string | null = null;
let savedOriginal = false;

function getCurrentFaviconUrl(): string | null {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"]'
  );
  return link?.href ?? null;
}

function setFavicon(url: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

function drawCountdownFavicon(progress: number): string {
  const canvas = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE);
  const ctx = canvas.getContext("2d")!;

  // Gray circle background
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, ARC_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = BG_COLOR;
  ctx.lineWidth = ARC_LINE_WIDTH;
  ctx.stroke();

  // Red progress arc (clockwise from 12 o'clock)
  if (progress > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * Math.min(progress, 1);
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, ARC_RADIUS, startAngle, endAngle);
    ctx.strokeStyle = ARC_COLOR;
    ctx.lineWidth = ARC_LINE_WIDTH;
    ctx.stroke();
  }

  // Convert to data URL via a regular canvas (OffscreenCanvas lacks toDataURL)
  const bitmap = canvas.transferToImageBitmap();
  const visibleCanvas = document.createElement("canvas");
  visibleCanvas.width = CANVAS_SIZE;
  visibleCanvas.height = CANVAS_SIZE;
  const visibleCtx = visibleCanvas.getContext("bitmaprenderer");
  if (visibleCtx) {
    visibleCtx.transferFromImageBitmap(bitmap);
  }
  return visibleCanvas.toDataURL("image/png");
}

function handleMessage(
  message: FaviconMessage,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void
): void {
  if (message.type === "UPDATE_COUNTDOWN_PROGRESS") {
    if (!savedOriginal) {
      originalFaviconUrl = getCurrentFaviconUrl();
      savedOriginal = true;
    }
    const dataUrl = drawCountdownFavicon(message.progress);
    setFavicon(dataUrl);
  } else if (message.type === "RESTORE_FAVICON") {
    if (savedOriginal && originalFaviconUrl) {
      setFavicon(originalFaviconUrl);
    } else if (savedOriginal) {
      // Original page had no favicon — remove the one we added
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      link?.remove();
    }
    savedOriginal = false;
    originalFaviconUrl = null;
  }
}

chrome.runtime.onMessage.addListener(handleMessage);
