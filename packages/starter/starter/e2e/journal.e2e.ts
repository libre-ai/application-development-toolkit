import { expect, test } from "@playwright/test";

async function loginViaUI(page: import("@playwright/test").Page): Promise<void> {
  // Hydration: wait for client module to execute and set data-hydrated
  // Use waitForFunction to poll the attribute since it's set asynchronously
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute("data-hydrated") === "true";
  });

  // Click the login button
  await page.locator("button", { hasText: "Se connecter" }).click();

  // The login flow will navigate to the dev-issuer authorization endpoint
  // which automatically issues a code and redirects to /v1/auth/callback
  // which sets the session cookie and redirects back to /
  await page.waitForURL("**/", { timeout: 10_000 });

  // Verify the UI has hydrated data by checking for authenticated content
  // The authenticated state should show the form to add notes
  await expect(page.locator("textarea[placeholder='Entrez votre note…']")).toBeVisible();
}

test("login flow: clicking login button initiates OIDC flow", async ({ page }) => {
  // Navigate to home
  await page.goto("/");

  // Verify hydration
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute("data-hydrated") === "true";
  });

  // Before login: unauthenticated
  let sessionState = await page.evaluate(async () => {
    const res = await fetch("/api/session");
    return res.json();
  });
  expect(sessionState.authenticated).toBe(false);

  // Click the login button
  await page.locator("button", { hasText: "Se connecter" }).click();

  // The login flow navigates through dev-issuer and redirects back to /
  await page.waitForURL("**/", { timeout: 10_000 });

  // After login: authenticated UI should be rendered
  const textarea = page.locator("textarea[placeholder='Entrez votre note…']");
  await expect(textarea).toBeVisible({ timeout: 5_000 });

  // Verify authenticated state
  sessionState = await page.evaluate(async () => {
    const res = await fetch("/api/session");
    return res.json();
  });
  expect(sessionState.authenticated).toBe(true);
  expect(sessionState.userId).toBeDefined();
  expect(sessionState.tenantId).toBeDefined();
});

test("add note via UI and verify in list", async ({ page }) => {
  await page.goto("/");
  await loginViaUI(page);

  // Wait for the session to fully load (includes CSRF token)
  // The CSRF token is fetched in the useEffect after authentication
  await page.waitForTimeout(1000);

  // Fill in the note textarea
  const textarea = page.locator("textarea[placeholder='Entrez votre note…']");
  await expect(textarea).toBeEnabled({ timeout: 5_000 });
  await textarea.fill("Test note from UI");

  // Click the submit button
  const submitButton = page.locator("button", { hasText: "Ajouter la note" });
  await submitButton.click();

  // Wait for success message
  const message = page.locator("[data-testid='message']");
  await expect(message).toBeVisible({ timeout: 10_000 });

  // Verify it's a success message
  const messageText = await message.textContent();
  expect(messageText).toContain("Note ajoutée avec succès");

  // Verify the note appears in the list
  const noteList = page.locator("[data-testid='note-list']");
  await expect(noteList).toContainText("Test note from UI");
});

test("empty note is rejected with error message", async ({ page }) => {
  await page.goto("/");
  await loginViaUI(page);

  // Wait a bit for the session to be loaded
  await page.waitForTimeout(500);

  // Try to submit empty note (textarea is empty by default)
  const submitButton = page.locator("button", { hasText: "Ajouter la note" });
  await submitButton.click();

  // Error message should appear
  const message = page.locator("[data-testid='message']");
  await expect(message).toBeVisible({ timeout: 10_000 });

  // Verify it's an error message about empty note
  const messageText = await message.textContent();
  expect(messageText).toMatch(/Veuillez entrer du texte pour la note/);

  // Note list should remain empty
  const noteList = page.locator("[data-testid='note-list']");
  await expect(noteList).not.toBeVisible();
});

test("contracts validation playground via UI", async ({ page }) => {
  await page.goto("/");
  await loginViaUI(page);

  // Wait a bit for the session and schemas to be loaded
  await page.waitForTimeout(500);

  // Wait for schema select to be populated
  const schemaSelect = page.locator("#schema-select");
  await expect(schemaSelect).toBeEnabled();

  // Get first schema option (skip the placeholder "Sélectionner un schéma…")
  const firstSchema = schemaSelect.locator("option").nth(1);
  const schemaValue = await firstSchema.getAttribute("value");

  // Select the first schema
  if (schemaValue === null) throw new Error("Expected a selectable schema");
  await schemaSelect.selectOption(schemaValue);

  // Fill in JSON document
  const jsonTextarea = page.locator("textarea[placeholder='{}']");
  await jsonTextarea.fill("{}");

  // Click validate button
  const validateButton = page.locator("button", { hasText: "Valider" });
  await validateButton.click();

  // Message should appear (either valid or invalid)
  const statusMessage = page.locator("[data-testid='message']");
  await expect(statusMessage).toBeVisible({ timeout: 10_000 });
  const text = await statusMessage.textContent();
  expect(text).toMatch(/Document (valide|invalide)/);
});
