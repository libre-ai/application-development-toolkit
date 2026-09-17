import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ActionButton, SkipLink, StatusMessage, Surface } from "./primitives";
import { buildTailwindUtilities } from "./tailwind";

describe("accessible design primitives", () => {
  test("derives production component colors only from adopted semantic tokens", async () => {
    const stylesheet = await Bun.file(new URL("./styles.css", import.meta.url)).text();
    const colorLiterals = stylesheet.match(/#[0-9a-f]{3,8}\b|\brgb\(|\bhsl\(|\boklch\(/gi) ?? [];

    expect(stylesheet.startsWith('@import "./tokens.css";')).toBe(true);
    expect(colorLiterals).toEqual([]);
    expect(stylesheet).toContain("--lai-color-accent: var(--lai-color-action-primary);");
  });

  test("renders semantic controls and landmarks without client JavaScript", () => {
    const markup = renderToStaticMarkup(
      <>
        <SkipLink targetId="content" />
        <Surface as="article" aria-labelledby="title">
          <h2 id="title">Fondation</h2>
          <ActionButton>Confirmer</ActionButton>
          <StatusMessage>Prêt</StatusMessage>
        </Surface>
      </>,
    );

    expect(markup).toContain('href="#content"');
    expect(markup).toContain("<article");
    expect(markup).toContain("<button");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });

  test("does not use remote assets or inline event handlers", () => {
    const markup = renderToStaticMarkup(<ActionButton>Continuer</ActionButton>);
    expect(markup).not.toContain("http://");
    expect(markup).not.toContain("https://");
    expect(markup).not.toContain("onclick=");
  });

  test("builds deterministic bounded Tailwind v4 utilities", async () => {
    const first = await buildTailwindUtilities(["text-sm", "text-sm"]);
    const second = await buildTailwindUtilities(["text-sm"]);
    expect(first).toBe(second);
    expect(first).toContain(".text-sm");
    await expect(buildTailwindUtilities(["bg-[url(https://remote.invalid)]"])).rejects.toThrow(
      "design.tailwind_candidate_invalid",
    );
  });
});
