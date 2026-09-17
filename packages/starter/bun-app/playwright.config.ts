import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      testMatch: /reference\.e2e\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: /reference\.e2e\.ts/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: /reference\.e2e\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
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
      name: "chromium-reduced-motion",
      testMatch: /reduced-motion\.e2e\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        contextOptions: { reducedMotion: "reduce" },
      },
    },
  ],
  testDir: "./e2e",
  testMatch: /.*\.e2e\.ts/,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run start",
    env: { HOST: "127.0.0.1", PORT: "4173" },
    port: 4173,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
