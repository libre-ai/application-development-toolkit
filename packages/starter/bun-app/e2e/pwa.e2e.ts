import { expect, test } from "@playwright/test";

test("the static shell remains available offline after local caching", async ({
  context,
  page,
}) => {
  await page.goto("/static");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bun direct");
  } finally {
    await context.setOffline(false);
  }
});
