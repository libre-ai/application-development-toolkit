import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: true,
  projects: [
    {
      name: "chromium-no-js",
      testMatch: /no-js\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
    },
    {
      name: "chromium-pwa",
      testMatch: /pwa\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: /journal\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
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
      use: { ...devices["Desktop Chrome"] },
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
