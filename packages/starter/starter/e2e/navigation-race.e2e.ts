import { expect, type Response, test } from "@playwright/test";
import { withDiagnosticCleanup } from "./diagnostic-cleanup";
import { loginViaUI } from "./login-via-ui";

test("login waits for the redirected document before checking the authenticated form", async ({
  page,
}) => {
  const session = await page.context().newCDPSession(page);
  let delayedReturnDocument = false;
  let callbackObserved = false;
  const pendingResponses: Promise<void>[] = [];
  const responseErrors: unknown[] = [];
  function observedCallback(response: Response): void {
    if (new URL(response.url()).pathname === "/v1/auth/callback") callbackObserved = true;
  }
  page.on("response", observedCallback);
  session.on("Fetch.requestPaused", (event) => {
    const pending = (async () => {
      if (callbackObserved && event.resourceType === "Document") {
        delayedReturnDocument = true;
        await new Promise<void>((resolve) => setTimeout(resolve, 6_000));
      }
      await session.send("Fetch.continueRequest", { requestId: event.requestId });
    })().catch((error: unknown) => {
      responseErrors.push(error);
    });
    pendingResponses.push(pending);
  });
  await withDiagnosticCleanup(
    async () => {
      await session.send("Fetch.enable", {
        patterns: [{ urlPattern: "https://127.0.0.1:3000/", requestStage: "Response" }],
      });
      await page.goto("/");
      await loginViaUI(page);
      expect(delayedReturnDocument).toBe(true);
    },
    async () => {
      page.off("response", observedCallback);
      await Promise.all(pendingResponses);
      try {
        await session.detach();
      } catch (error: unknown) {
        responseErrors.push(error);
      }
      expect(responseErrors).toEqual([]);
    },
  );
});
