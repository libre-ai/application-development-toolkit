import { expect, test } from "@playwright/test";

test("reduced motion is honored by the browser fixture and CSS", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
    true,
  );
  const duration = await page
    .getByRole("button", { name: "Vérifier l’interaction" })
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
