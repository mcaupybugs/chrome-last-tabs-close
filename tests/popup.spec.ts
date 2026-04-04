import { test, expect } from "./fixtures";

test.describe("Popup UI", () => {
  test("should render popup with all core elements", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    // Header & title
    await expect(popup.locator(".title")).toHaveText("Tab Auto-Close");

    // Toggle switch exists (input is hidden by CSS, check the label wrapper)
    const toggle = popup.locator(".switch").first();
    await expect(toggle).toBeVisible();

    // Status label
    const statusLabel = popup.locator("#statusLabel");
    await expect(statusLabel).toBeVisible();

    // Stats section
    await expect(popup.locator("#statsText")).toBeVisible();

    // Countdown section
    await expect(popup.locator("#countdownList")).toBeVisible();

    // History section
    await expect(popup.locator("#historyList")).toBeVisible();

    // Settings link
    await expect(popup.locator("#settingsLink")).toHaveText("⚙ Settings");

    await popup.close();
  });

  test("should toggle extension on/off", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    const toggle = popup.locator("#enableToggle");
    const statusLabel = popup.locator("#statusLabel");

    // Wait for initial status fetch to complete
    await popup.waitForTimeout(1500);

    // Disable — toggle the checkbox and fire change event
    await toggle.evaluate((el: HTMLInputElement) => {
      el.checked = false;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });

    // Wait for the 3-second refresh cycle to pick up the new state
    await expect(statusLabel).toHaveText("Paused", { timeout: 5000 });

    // Re-enable
    await toggle.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(statusLabel).toHaveText("Active", { timeout: 5000 });

    await popup.close();
  });

  test("should show empty states by default", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    await expect(popup.locator("#countdownList .empty-state")).toBeVisible();
    await expect(popup.locator("#historyList .empty-state")).toBeVisible();

    await popup.close();
  });
});
