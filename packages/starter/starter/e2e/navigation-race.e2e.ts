import { expect, type Response, test } from "@playwright/test";
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
  await session.send("Fetch.enable", {
    patterns: [{ urlPattern: "https://127.0.0.1:3000/", requestStage: "Response" }],
  });
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
  try {
    await page.goto("/");
    await loginViaUI(page);
    expect(delayedReturnDocument).toBe(true);
  } finally {
    page.off("response", observedCallback);
    await Promise.all(pendingResponses);
    await session.detach();
    expect(responseErrors).toEqual([]);
  }
});
