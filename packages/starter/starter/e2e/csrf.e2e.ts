import { expect, test } from "@playwright/test";

const IDEMPOTENCY = `idem_${"e".repeat(16)}`;

async function login(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  const authorizationUrl = await page.evaluate(async (idempotency) => {
    const response = await fetch("/v1/auth/login", {
      body: JSON.stringify({ returnPath: "/" }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotency,
        "If-Match": '"0"',
      },
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`login failed: ${response.status}`);
    }
    const body = (await response.json()) as { authorizationUrl: string };
    return body.authorizationUrl;
  }, IDEMPOTENCY);
  await page.goto(authorizationUrl);
  await page.waitForURL("**/");
}

test("POST /api/notes without CSRF token is rejected with 403", async ({ page }) => {
  await login(page);

  // Attempt to POST a note without the CSRF token
  const response = await page.evaluate(async () => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Intentionally omit X-CSRF-Token
      },
      body: JSON.stringify({
        text: "Bypassed note",
        createdAt: new Date().toISOString(),
      }),
    });
    return { status: res.status, body: await res.json() };
  });

  // Should be rejected due to missing CSRF token
  expect(response.status).toBe(403);
  expect(response.body).toHaveProperty("error.code", "auth.csrf_invalid");
});

test("POST /api/notes with valid CSRF token succeeds", async ({ page }) => {
  await login(page);

  // Get a valid CSRF token
  const csrfToken = await page.evaluate(async () => {
    const res = await fetch("/e2e/csrf");
    if (!res.ok) {
      throw new Error("Failed to fetch CSRF token");
    }
    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  });
  expect(csrfToken.length).toBeGreaterThan(0);

  // POST a note with the CSRF token
  const response = await page.evaluate(async (token) => {
    const createdAt = new Date()
      .toISOString()
      .replace(/\.\d{3}/, "")
      .replace("Z", "Z");
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
      },
      body: JSON.stringify({
        text: "Protected note",
        createdAt,
      }),
    });
    return { status: res.status, body: await res.json() };
  }, csrfToken);

  // Should succeed with 201 Created
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty("ok", true);
});
