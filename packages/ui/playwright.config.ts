import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./brand",
  testMatch: "*.e2e.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    {
      name: "chromium-no-js",
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
    {
      name: "chromium-reduced-motion",
      use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" },
    },
    {
      name: "chromium-forced-colors",
      use: { ...devices["Desktop Chrome"], forcedColors: "active" },
    },
  ],
});
