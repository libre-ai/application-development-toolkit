import { expect, type Frame, type Page, type Request, type Response } from "@playwright/test";

interface BootstrapNavigation {
  callbackStatus: number | null;
  returnCommitted: boolean;
  loadCompleted: boolean;
}

export async function observeLoginBootstrap(
  page: Pick<Page, "on" | "off" | "isClosed" | "context">,
  returnUrl: string,
  scenario: (navigation: BootstrapNavigation) => Promise<void>,
  emit: (line: string) => void = (line) => console.info(line),
): Promise<void> {
  const origin = new URL(returnUrl).origin;
  const context = page.context();
  const browser = context.browser();
  const counters = () => ({
    requests: 0,
    responses: 0,
    failures: 0,
    lastStatus: null as number | null,
  });
  const report = {
    diagnostic: "login-bootstrap",
    lifecycle: {
      initialPageClosed: page.isClosed(),
      initialBrowserConnected: browser?.isConnected() ?? null,
      pageCrash: false,
      pageClose: false,
      contextClose: false,
      browserDisconnected: false,
    },
    navigation: {
      callbackStatus: null,
      returnCommitted: false,
      loadCompleted: false,
    } as BootstrapNavigation,
    beforeReturn: { session: counters(), script: counters() },
    afterReturn: { session: counters(), script: counters() },
    saturated: false,
    captureUnavailable: false,
  };
  function selected(request: Request) {
    const url = new URL(request.url());
    if (url.origin !== origin) return null;
    const phase = report.navigation.returnCommitted ? report.afterReturn : report.beforeReturn;
    if (url.pathname === "/api/session") return phase.session;
    if (url.pathname === "/assets/app.js" && request.resourceType() === "script")
      return phase.script;
    return null;
  }
  function increment(
    counts: ReturnType<typeof counters>,
    field: "requests" | "responses" | "failures",
  ) {
    if (counts[field] === 1_000) report.saturated = true;
    else counts[field] += 1;
  }
  function requested(request: Request): void {
    try {
      const counts = selected(request);
      if (counts) increment(counts, "requests");
    } catch {
      report.captureUnavailable = true;
    }
  }
  function responded(response: Response): void {
    try {
      const counts = selected(response.request());
      if (!counts) return;
      increment(counts, "responses");
      const status = response.status();
      counts.lastStatus =
        Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
    } catch {
      report.captureUnavailable = true;
    }
  }
  function failed(request: Request): void {
    try {
      const counts = selected(request);
      if (counts) increment(counts, "failures");
    } catch {
      report.captureUnavailable = true;
    }
  }
  function pageCrashed(): void {
    report.lifecycle.pageCrash = true;
  }
  function pageClosed(): void {
    report.lifecycle.pageClose = true;
  }
  function contextClosed(): void {
    report.lifecycle.contextClose = true;
  }
  function browserDisconnected(): void {
    report.lifecycle.browserDisconnected = true;
  }
  page.on("crash", pageCrashed);
  page.on("close", pageClosed);
  context.on("close", contextClosed);
  browser?.on("disconnected", browserDisconnected);
  page.on("request", requested);
  page.on("response", responded);
  page.on("requestfailed", failed);
  try {
    await scenario(report.navigation);
  } catch (primary: unknown) {
    try {
      emit(JSON.stringify(report));
    } catch {
      try {
        console.error("login-bootstrap-diagnostic-unavailable");
      } catch {
        /* The original test error remains authoritative if both sinks fail. */
      }
    }
    throw primary;
  } finally {
    page.off("crash", pageCrashed);
    page.off("close", pageClosed);
    context.off("close", contextClosed);
    browser?.off("disconnected", browserDisconnected);
    page.off("request", requested);
    page.off("response", responded);
    page.off("requestfailed", failed);
  }
}

export async function loginViaUI(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return document.documentElement.getAttribute("data-hydrated") === "true";
  });

  const returnUrl = new URL("/", page.url()).href;
  await observeLoginBootstrap(page, returnUrl, async (diagnostic) => {
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
        diagnostic.callbackStatus = response.status();
        if (returned) complete(response);
      }
    }
    function committedDocument(frame: Frame): void {
      if (frame === page.mainFrame() && frame.url() === returnUrl) {
        returned = true;
        diagnostic.returnCommitted = true;
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
      diagnostic.loadCompleted = true;
    } finally {
      clearTimeout(deadline);
      page.off("response", observedCallback);
      page.off("framenavigated", committedDocument);
    }

    await expect(page.locator("textarea[placeholder='Entrez votre note…']")).toBeVisible();
  });
}
