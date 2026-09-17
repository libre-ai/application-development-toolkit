import { expect, type Frame, type Page, type Response } from "@playwright/test";

export async function loginViaUI(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute("data-hydrated") === "true";
  });

  const returnUrl = new URL("/", page.url()).href;
  let callback: Response | null = null;
  let returned = false;
  let complete: (response: Response) => void = () => {};
  let refuse: (error: Error) => void = () => {};
  const navigation = new Promise<Response>((resolve, reject) => {
    complete = resolve;
    refuse = reject;
  });
  function observedCallback(response: Response): void {
    if (
      new URL(response.url()).pathname === "/v1/auth/callback" &&
      response.request().isNavigationRequest() &&
      response.frame() === page.mainFrame()
    ) {
      callback = response;
      if (returned) complete(response);
    }
  }
  function committedDocument(frame: Frame): void {
    if (frame === page.mainFrame() && frame.url() === returnUrl) {
      returned = true;
      if (callback) complete(callback);
    }
  }
  // A URL predicate alone can match the old home document after the callback 303.
  // Observe a new main-frame commit before spending the UI assertion budget.
  page.on("response", observedCallback);
  page.on("framenavigated", committedDocument);
  const deadline = setTimeout(
    () => refuse(new Error("OIDC return document was not committed")),
    10_000,
  );
  try {
    const [response] = await Promise.all([
      navigation,
      page.locator("button", { hasText: "Se connecter" }).click(),
    ]);
    expect(response.status()).toBe(303);
    await page.waitForLoadState("load", { timeout: 10_000 });
  } finally {
    clearTimeout(deadline);
    page.off("response", observedCallback);
    page.off("framenavigated", committedDocument);
  }

  await expect(page.locator("textarea[placeholder='Entrez votre note…']")).toBeVisible();
}
