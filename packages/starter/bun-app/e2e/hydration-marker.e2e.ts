import { expect, test } from "@playwright/test";

// `data-hydrated="true"` is the signal every consumer e2e waits on before it
// interacts or asserts the hydration verdict (`data-hydration="recovered"`). It
// must therefore only appear once React has committed the hydrated tree: if it
// appears earlier, `not.toHaveAttribute("data-hydration", "recovered")` is
// evaluated before React has even compared the markup, and passes on a page whose
// hydration actually fails. A recovered hydration client-renders the document and
// resets the `<html>` attributes, so a marker written before the commit is erased
// and the progressive-enhancement controls stay hidden.

test("the hydration marker appears only once the recovery verdict is final", async ({ page }) => {
  await page.addInitScript(() => {
    const probe = window as unknown as { hydrationVerdictAtMarker?: string | null };
    new MutationObserver((records, observer) => {
      for (const record of records) {
        const target = record.target;
        // Force a deterministic server/client text mismatch: rewrite the heading
        // as soon as the parser inserts it, before the client module runs.
        for (const node of record.addedNodes) {
          if (node instanceof HTMLHeadingElement && node.id === "page-title") {
            node.textContent = "Contenu divergent du rendu serveur";
          }
        }
        if (
          record.type === "attributes" &&
          target instanceof HTMLHtmlElement &&
          target.dataset.hydrated === "true"
        ) {
          probe.hydrationVerdictAtMarker = target.dataset.hydration ?? null;
          observer.disconnect();
          return;
        }
      }
    }).observe(document, {
      attributeFilter: ["data-hydrated"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true");
  // The mismatch really happened and was recovered by a client render.
  await expect(page.locator("html")).toHaveAttribute("data-hydration", "recovered");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bun direct");

  const verdictAtMarker = await page.evaluate(
    () =>
      (window as unknown as { hydrationVerdictAtMarker?: string | null }).hydrationVerdictAtMarker,
  );
  expect(verdictAtMarker).toBe("recovered");
});
