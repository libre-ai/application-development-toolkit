import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: true,
  projects: [
    {
      name: "chromium-no-js",
      testMatch: /no-js\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chromium", javaScriptEnabled: false },
    },
    {
      name: "chromium-pwa",
      testMatch: /pwa\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chromium", ignoreHTTPSErrors: false },
    },
    {
      name: "chromium",
      testMatch: /(?:journal|navigation-race)\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
    {
      name: "firefox",
      testMatch: /journal\.e2e\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: /journal\.e2e\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "chromium-csrf",
      testMatch: /csrf\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  use: {
    baseURL: "https://127.0.0.1:3000",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run build && bun src/server/index.ts",
    env: { HOST: "127.0.0.1", PORT: "3000" },
    port: 3000,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
