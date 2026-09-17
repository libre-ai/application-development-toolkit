import { expect, test } from "@playwright/test";

test("SSR hydrates and keyboard interaction remains accessible", async ({ browserName, page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bun direct");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-hydration", "recovered");

  const skipLink = page.getByRole("link", { name: "Aller au contenu" });
  if (browserName === "webkit") {
    // macOS WebKit honors the OS full-keyboard-access preference; focus explicitly there.
    await skipLink.focus();
  } else {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const button = page.getByRole("button", { name: "Vérifier l’interaction" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("interaction-status")).toHaveText("1 interaction vérifiée.");
});

test("JSON and static modes use local assets and security headers", async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") remoteRequests.push(request.url());
  });

  const response = await page.goto("/static");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator("html")).not.toHaveAttribute("data-hydration", "recovered");
  await page.getByRole("button", { name: "Vérifier l’interaction" }).click();
  await expect(page.getByTestId("interaction-status")).toHaveText("1 interaction vérifiée.");
  expect(remoteRequests).toEqual([]);

  const health = await page.request.get("/api/health");
  expect(await health.json()).toEqual({
    service: "libre-ai-bun-reference",
    status: "ok",
    version: "v1",
  });
});
