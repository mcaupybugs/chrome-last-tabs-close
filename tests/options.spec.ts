import { test, expect } from "./fixtures";

test.describe("Options Page", () => {
  test("should render all settings sections", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // Page title
    await expect(options.locator("header h1")).toContainText("Tab Manager Settings");

    // Rules section — inactivity rule toggle & slider
    // Toggle inputs are hidden by CSS (custom switch), verify the switch wrapper is visible
    await expect(options.locator(".switch").first()).toBeVisible();
    await expect(options.locator("#inactivityTimeout")).toBeVisible();
    await expect(options.locator("#inactivityValue")).toHaveText("30");

    // Rules section — max tabs rule toggle & input
    // Rules section — max tabs rule (switch wrapper visible, input hidden by CSS)
    await expect(options.locator(".switch").nth(1)).toBeVisible();
    await expect(options.locator("#maxTabs")).toBeVisible();
    await expect(options.locator("#maxTabs")).toHaveValue("20");

    // Countdown section
    await expect(options.locator("#countdownDuration")).toBeVisible();
    await expect(options.locator("#countdownValue")).toHaveText("60");

    // Whitelist section
    await expect(options.locator("#domainInput")).toBeVisible();
    await expect(options.locator("#addDomainBtn")).toBeVisible();

    // History section
    await expect(options.locator("#historyList")).toBeVisible();
    await expect(options.locator("#clearHistoryBtn")).toBeVisible();

    await options.close();
  });

  test("should update inactivity timeout slider value", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    const slider = options.locator("#inactivityTimeout");
    const valueLabel = options.locator("#inactivityValue");

    // Change slider value programmatically and fire input event
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = "60";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(valueLabel).toHaveText("60");

    await options.close();
  });

  test("should update max tabs value", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    const input = options.locator("#maxTabs");
    await input.fill("30");
    await input.dispatchEvent("input");
    await expect(input).toHaveValue("30");

    await options.close();
  });

  test("should add and remove whitelisted domain", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // Add a domain
    await options.locator("#domainInput").fill("gmail.com");
    await options.locator("#addDomainBtn").click();

    // Verify chip appeared
    const chip = options.locator(".domain-chip").first();
    await expect(chip).toContainText("gmail.com");

    // Remove the domain
    await chip.locator(".remove-btn").click();
    await expect(options.locator(".domain-chip")).toHaveCount(0);

    await options.close();
  });

  test("should disable rule body when toggle is unchecked", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    const inactivityToggle = options.locator("#enableInactivityRule");
    const ruleBody = options.locator("#inactivityRuleBody");

    // Wait for settings to load (toggle should be checked initially)
    await expect(inactivityToggle).toBeChecked({ timeout: 3000 });

    // Uncheck the toggle
    await inactivityToggle.evaluate((el: HTMLInputElement) => {
      el.checked = false;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(ruleBody).toHaveClass(/disabled/, { timeout: 3000 });

    // Re-check
    await inactivityToggle.evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(ruleBody).not.toHaveClass(/disabled/, { timeout: 3000 });
    await expect(ruleBody).not.toHaveClass(/disabled/);

    await options.close();
  });

  test("should show toast on settings save", async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);

    // Change a value to trigger save
    await options.locator("#maxTabs").fill("25");
    await options.locator("#maxTabs").dispatchEvent("input");

    // Wait for debounced save + toast
    const toast = options.locator("#toast");
    await expect(toast).toHaveClass(/visible/, { timeout: 2000 });

    await options.close();
  });
});
