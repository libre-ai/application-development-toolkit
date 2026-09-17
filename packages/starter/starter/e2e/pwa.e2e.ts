import { expect } from "@playwright/test";
import { test } from "./pwa-test-certificate";

// Fixed runtime metadata distinguishes a CLI protocol failure from a browser assertion.
test.beforeAll(() => {
  console.info(
    JSON.stringify({
      diagnostic: "pwa-test-runtime",
      runtime: process.release.name,
      version: process.version,
      platform: process.platform,
    }),
  );
});

test("PWA manifest is correctly served", async ({ page }) => {
  // Navigate to the app
  await test.step("open the online document", async () => {
    await page.goto("/");
  });

  // Verify manifest is served with correct content-type
  const result = await page.evaluate(async () => {
    const response = await fetch("/manifest.webmanifest");
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      manifest: await response.json(),
    };
  });
  expect(result.status).toBe(200);
  expect(result.type).toContain("application/manifest+json");

  // Check required manifest fields
  const manifest = result.manifest as Record<string, unknown>;
  expect(manifest).toHaveProperty("name");
  expect(manifest).toHaveProperty("start_url");
  expect(manifest).toHaveProperty("display", "standalone");
  expect(manifest).toHaveProperty("lang", "fr");
  expect(manifest.name).toContain("Libre AI");
});

test("service worker script is served correctly", async ({ page }) => {
  // Navigate to the app
  await test.step("open the online document", async () => {
    await page.goto("/");
  });

  // Verify the service worker script is accessible
  const result = await page.evaluate(async () => {
    const response = await fetch("/sw.js");
    return {
      status: response.status,
      type: response.headers.get("content-type"),
      text: await response.text(),
    };
  });
  expect(result.status).toBe(200);
  expect(result.type).toContain("text/javascript");

  // Verify the script contains the expected cache installation code
  const swContent = result.text;
  expect(swContent.length).toBeGreaterThan(0);
  expect(swContent).toContain("addEventListener");
  expect(swContent).toContain("install");
});

test("PWA cached shell serves offline", async ({ page, context }) => {
  await test.step("open the initial online document", async () => {
    await page.goto("/");
  });
  await test.step("wait for the real service worker cache installation", async () => {
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) throw new Error("pwa.missing_active_worker");
      if (worker.state !== "activated") {
        await new Promise<void>((resolve, reject) => {
          const changed = () => {
            if (worker.state === "activated") {
              worker.removeEventListener("statechange", changed);
              resolve();
            } else if (worker.state === "redundant") {
              worker.removeEventListener("statechange", changed);
              reject(new Error("pwa.worker_activation_failed"));
            }
          };
          worker.addEventListener("statechange", changed);
          changed();
        });
      }
      return worker.state;
    });
    expect(state).toBe("activated");
  });

  await context.setOffline(true);
  try {
    await test.step("navigate offline using the cached service worker response", async () => {
      const response = await page.goto("/static");
      expect(response).not.toBeNull();
      expect(response?.status()).toBe(200);
      expect(response?.fromServiceWorker()).toBe(true);
      await expect(page.getByRole("heading", { name: "Journal souverain" })).toBeVisible();
    });
    await test.step("fetch the cached stylesheet through the offline browser", async () => {
      const [response, result] = await Promise.all([
        page.waitForResponse(
          (value) =>
            new URL(value.url()).pathname === "/assets/styles.css" &&
            value.request().resourceType() === "fetch",
        ),
        page.evaluate(async () => {
          const response = await fetch("/assets/styles.css");
          return { status: response.status, bytes: (await response.text()).length };
        }),
      ]);
      expect(response.fromServiceWorker()).toBe(true);
      expect(result.status).toBe(200);
      expect(result.bytes).toBeGreaterThan(0);
    });
    await test.step("prove an uncached browser request cannot reach the network", async () => {
      const reachedNetwork = await page.evaluate(async () => {
        try {
          await fetch("/uncached-offline-probe");
          return true;
        } catch {
          return false;
        }
      });
      expect(reachedNetwork).toBe(false);
    });
  } finally {
    await context.setOffline(false);
  }
});

test("an unrelated public-key pin does not permit the test TLS certificate", async ({
  playwright,
}) => {
  const wrongPin = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  const browser = await playwright.chromium.launch({
    args: [`--ignore-certificate-errors-spki-list=${wrongPin}`],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: false });
    const page = await context.newPage();
    await expect(page.goto("https://127.0.0.1:3000/")).rejects.toThrow(
      "ERR_CERT_AUTHORITY_INVALID",
    );
  } finally {
    await browser.close();
  }
});
