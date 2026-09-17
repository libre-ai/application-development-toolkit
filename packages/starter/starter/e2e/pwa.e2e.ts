import { expect, test } from "@playwright/test";

test("PWA manifest is correctly served", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Verify manifest is served with correct content-type
  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");

  // Check required manifest fields
  const manifest = (await manifestResponse.json()) as Record<string, unknown>;
  expect(manifest).toHaveProperty("name");
  expect(manifest).toHaveProperty("start_url");
  expect(manifest).toHaveProperty("display", "standalone");
  expect(manifest).toHaveProperty("lang", "fr");
  expect(manifest.name).toContain("Libre AI");
});

test("service worker script is served correctly", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Verify the service worker script is accessible
  const swResponse = await page.request.get("/sw.js");
  expect(swResponse.status()).toBe(200);
  expect(swResponse.headers()["content-type"]).toContain("text/javascript");

  // Verify the script contains the expected cache installation code
  const swContent = await swResponse.text();
  expect(swContent.length).toBeGreaterThan(0);
  expect(swContent).toContain("addEventListener");
  expect(swContent).toContain("install");
});

test("PWA cached shell serves offline", async ({ page, context }) => {
  // Load the app to trigger SW installation and caching
  await page.goto("/");

  // Register and activate the service worker
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Registration may fail if already registered
      }
    }
  });

  // Wait briefly for caching
  await page.waitForTimeout(1000);

  // Block the network to simulate offline mode
  await context.setOffline(true);

  try {
    // Try to fetch the static index (should be cached)
    const staticResponse = await page.request.get("/static");
    expect(staticResponse.status()).toBe(200);

    // Try to fetch a cached asset (should succeed from cache)
    const assetsResponse = await page.request.get("/assets/styles.css");
    expect(assetsResponse.status()).toBe(200);
  } finally {
    // Restore network connectivity
    await context.setOffline(false);
  }
});
