import { expect, type Page, test } from "@playwright/test";
import { withDiagnosticCleanup } from "./diagnostic-cleanup";

const IDEMPOTENCY = `idem_${"e".repeat(16)}`;

async function login(page: import("@playwright/test").Page): Promise<void> {
  await test.step("open the CSRF fixture document", async () => {
    await page.goto("/");
  });
  const authorizationUrl = await test.step("request the mock authorization URL", async () =>
    page.evaluate(async (idempotency) => {
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
    }, IDEMPOTENCY));
  await test.step("complete the mock OIDC callback navigation", async () => {
    await page.goto(authorizationUrl);
    await page.waitForURL("**/");
  });
}

async function loginWithReadyUi(page: Page): Promise<void> {
  await login(page);
  // The UI issues its own rotating CSRF token after hydration. Only acquire a
  // test token once that issuance has completed, otherwise the UI can invalidate it.
  await expect(page.getByRole("button", { name: "Ajouter la note", exact: true })).toBeEnabled();
}

test("POST /api/notes without CSRF token is rejected with 403", async ({ page }) => {
  await login(page);

  // Attempt to POST a note without the CSRF token
  const response = await test.step("submit without a CSRF token", async () =>
    page.evaluate(async () => {
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
    }));

  // Should be rejected due to missing CSRF token
  expect(response.status).toBe(403);
  expect(response.body).toHaveProperty("error.code", "auth.csrf_invalid");
});

test("POST /api/notes with valid CSRF token succeeds", async ({ page }) => {
  await loginWithReadyUi(page);

  // Get a valid CSRF token
  const csrfToken = await test.step("obtain the session CSRF token", async () =>
    page.evaluate(async () => {
      const res = await fetch("/e2e/csrf");
      if (!res.ok) {
        throw new Error("Failed to fetch CSRF token");
      }
      const data = (await res.json()) as { csrfToken: string };
      return data.csrfToken;
    }));
  expect(csrfToken.length).toBeGreaterThan(0);

  // POST a note with the CSRF token
  const response = await test.step("submit with the session CSRF token", async () =>
    page.evaluate(async (token) => {
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
    }, csrfToken));

  // Should succeed with 201 Created
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty("ok", true);
});

function barrier(): { promise: Promise<void>; release: () => void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

async function postNoteWithToken(page: Page, token: string): Promise<number> {
  return page.evaluate(async (csrfToken) => {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({
        text: "Controlled rotation note",
        createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      }),
    });
    return response.status;
  }, token);
}

test("a later UI CSRF acquisition invalidates an earlier explicit token", async ({ page }) => {
  const requested = barrier();
  const releaseUi = barrier();
  const completed = barrier();
  let uiToken = "";
  let routeError: unknown = null;
  await page.route("**/e2e/csrf", async (route) => {
    if (route.request().headers()["x-test-csrf-acquisition"] === "explicit") {
      await route.continue();
      return;
    }
    requested.release();
    try {
      await releaseUi.promise;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      uiToken = (await response.json()).csrfToken;
      await route.fulfill({ response });
    } catch (error: unknown) {
      routeError = error;
    } finally {
      completed.release();
    }
  });
  const settledLogin = login(page).then(
    () => ({ error: null }),
    (error: unknown) => ({ error }),
  );
  await withDiagnosticCleanup(
    async () => {
      await Promise.race([
        requested.promise,
        settledLogin.then((outcome) => {
          if (outcome.error !== null) throw outcome.error;
          return requested.promise;
        }),
      ]);
      const earlierToken = await page.evaluate(async () => {
        const response = await fetch("/e2e/csrf", {
          headers: { "X-Test-Csrf-Acquisition": "explicit" },
        });
        if (response.status !== 200) throw new Error("Explicit CSRF acquisition failed");
        return ((await response.json()) as { csrfToken: string }).csrfToken;
      });
      expect(earlierToken.length).toBeGreaterThan(0);
      releaseUi.release();
      await completed.promise;
      if (routeError !== null) throw routeError;
      expect(uiToken.length).toBeGreaterThan(0);
      expect(uiToken === earlierToken).toBe(false);
      expect(await postNoteWithToken(page, earlierToken)).toBe(403);
      expect(await postNoteWithToken(page, uiToken)).toBe(201);
    },
    async () => {
      releaseUi.release();
      await page.unrouteAll({ behavior: "wait" });
      const outcome = await settledLogin;
      if (outcome.error !== null) throw outcome.error;
      if (routeError !== null) throw routeError;
    },
  );
});

for (const acquisition of ["ready", "unavailable"] as const) {
  test(`mutation controls stay closed until CSRF acquisition: ${acquisition}`, async ({ page }) => {
    const requested = barrier();
    const releaseUi = barrier();
    const completed = barrier();
    let routeError: unknown = null;
    const posts: Array<{ path: string; hasToken: boolean }> = [];
    await page.addInitScript(() => {
      const fetchOriginal = window.fetch.bind(window);
      const state = { mutations: 0 };
      Object.defineProperty(window, "csrfOracle", { value: state });
      const observedFetch = async (...args: Parameters<typeof fetch>) => {
        const url = new URL(String(args[0]), location.href);
        if (args[1]?.method === "POST" && ["/api/notes", "/api/validate"].includes(url.pathname))
          state.mutations += 1;
        return fetchOriginal(...args);
      };
      Object.defineProperty(window, "fetch", { value: observedFetch });
    });
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "POST" && ["/api/notes", "/api/validate"].includes(path)) {
        posts.push({ path, hasToken: (request.headers()["x-csrf-token"]?.length ?? 0) > 0 });
      }
    });
    await page.route("**/e2e/csrf", async (route) => {
      requested.release();
      try {
        await releaseUi.promise;
        if (acquisition === "unavailable")
          await route.fulfill({ status: 503, body: "Unavailable" });
        else await route.continue();
      } catch (error: unknown) {
        routeError = error;
      } finally {
        completed.release();
      }
    });
    const settledLogin = login(page).then(
      () => ({ error: null }),
      (error: unknown) => ({ error }),
    );
    await withDiagnosticCleanup(
      async () => {
        await Promise.race([
          requested.promise,
          settledLogin.then((outcome) => {
            if (outcome.error !== null) throw outcome.error;
            return requested.promise;
          }),
        ]);
        const add = page.getByRole("button", { name: "Ajouter la note", exact: true });
        const validate = page.getByRole("button", { name: "Valider", exact: true });
        await expect(add).toBeDisabled();
        await expect(validate).toBeDisabled();
        await page
          .locator("textarea[placeholder='Entrez votre note…']")
          .fill("Ready protected note");
        const schema = await page.locator("#schema-select option").nth(1).getAttribute("value");
        if (schema === null) throw new Error("Expected available schema");
        await page.locator("#schema-select").selectOption(schema);
        await page.locator("#document-json").fill("{}");
        await page.locator("form").evaluateAll((forms) => {
          for (const form of forms)
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        expect(
          await page.evaluate(
            () => (window as unknown as { csrfOracle: { mutations: number } }).csrfOracle.mutations,
          ),
        ).toBe(0);
        expect(posts).toEqual([]);
        releaseUi.release();
        await completed.promise;
        if (routeError !== null) throw routeError;
        if (acquisition === "unavailable") {
          await expect(page.getByTestId("message")).toContainText(
            "Impossible de préparer les actions protégées.",
          );
          await expect(add).toBeDisabled();
          await expect(validate).toBeDisabled();
          expect(posts).toEqual([]);
          return;
        }
        await expect(add).toBeEnabled();
        await expect(validate).toBeEnabled();
        await add.click();
        await expect(page.getByTestId("message")).toContainText("Note ajoutée avec succès");
        await expect(page.getByTestId("note-list")).toContainText("Ready protected note");
        await validate.click();
        await expect(page.getByTestId("message")).toHaveText(/Document (valide|invalide)/);
        expect(posts).toEqual([
          { path: "/api/notes", hasToken: true },
          { path: "/api/validate", hasToken: true },
        ]);
      },
      async () => {
        releaseUi.release();
        await page.unrouteAll({ behavior: "wait" });
        const outcome = await settledLogin;
        if (outcome.error !== null) throw outcome.error;
        if (routeError !== null) throw routeError;
      },
    );
  });
}
