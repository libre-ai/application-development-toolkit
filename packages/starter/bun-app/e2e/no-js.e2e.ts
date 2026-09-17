import { expect, test } from "@playwright/test";

test("the document remains useful when JavaScript is disabled", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bun direct");
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
  await expect(
    page.getByText("Le contenu et les liens restent utilisables sans JavaScript."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Vérifier l’interaction" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-hydrated", "true");
});
