import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    headless: false, // Extensions require headed mode
  },
  projects: [
    {
      name: "chromium-extension",
      use: {
        browserName: "chromium",
      },
    },
  ],
});
