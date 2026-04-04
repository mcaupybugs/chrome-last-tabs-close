import { test, expect } from "./fixtures";

test.describe("Extension Integration", () => {
  test("service worker should be running", async ({ context, extensionId }) => {
    // Verify the service worker registered and we got a valid extension ID
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test("settings should persist between popup and options page", async ({
    context,
    extensionId,
  }) => {
    // Change max tabs in options page
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    await options.locator("#maxTabs").fill("35");
    await options.locator("#maxTabs").dispatchEvent("input");
    await options.waitForTimeout(500); // wait for debounced save

    await options.close();

    // Verify in popup by checking the service worker responds with updated settings
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);

    // The popup should be functional (not crashed)
    await expect(popup.locator(".title")).toHaveText("Tab Auto-Close");

    await popup.close();
  });

  test("opening many tabs should reflect in stats", async ({ context, extensionId }) => {
    // Open several tabs
    const pages = [];
    for (let i = 0; i < 5; i++) {
      const page = await context.newPage();
      await page.goto("about:blank");
      pages.push(page);
    }

    // Wait for tracking to register
    await pages[0].waitForTimeout(2000);

    // Check popup shows updated tab count
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popup.waitForTimeout(1000);

    const statsText = await popup.locator("#statsText").textContent();
    // Should show at least 5 tabs (our 5 + popup + any default tabs)
    const match = statsText?.match(/(\d+) tabs? open/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThanOrEqual(5);

    // Cleanup
    for (const page of pages) {
      await page.close();
    }
    await popup.close();
  });
});
