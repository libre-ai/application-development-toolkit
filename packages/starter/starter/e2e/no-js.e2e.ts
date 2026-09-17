import { expect, test } from "@playwright/test";

test("page is usable without JavaScript", async ({ page }) => {
  // Navigate to the app
  await page.goto("/");

  // Page title is visible (case-insensitive)
  expect(page).toHaveTitle(/journal souverain/i);

  // Main heading exists and is readable
  const mainHeading = page.locator("h1");
  await expect(mainHeading).toBeVisible();
  expect(await mainHeading.textContent()).toContain("Journal souverain");

  // Dev-issuer notice is visible (non-JS users need to see it too)
  const notice = page.locator(".lai-notice");
  await expect(notice).toBeVisible();
  const noticeText = await notice.textContent();
  expect(noticeText).toContain("Connexion de démonstration");
  expect(noticeText).toContain("émetteur local");

  // Without JS, data-hydrated attribute should not exist
  // (hydration only happens on the client with JS)
  const html = page.locator("html");
  const hasHydrated = await html.evaluate((el) => el.getAttribute("data-hydrated"));
  expect(hasHydrated).toBeNull();

  // Enhanced-only sections are hidden (but present in HTML)
  const enhancedSections = page.locator(".lai-enhanced-only");
  const count = await enhancedSections.count();
  expect(count).toBeGreaterThan(0);

  // Verify the document contains the static shell without authentication
  // (i.e., the unauthenticated login prompt is there)
  const loginSection = page.locator("text=Authentifiez-vous pour accéder");
  await expect(loginSection).toBeVisible();
});
