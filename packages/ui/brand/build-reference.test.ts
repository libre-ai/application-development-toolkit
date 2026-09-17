import { describe, expect, test } from "bun:test";

import { renderReferencePage } from "./build-reference";

describe("brand reference page", () => {
  test("renders the complete static qualification surface", () => {
    const html = renderReferencePage();

    for (const heading of [
      "Identity",
      "Proof",
      "Products",
      "Light",
      "Dark",
      "Forced colors",
      "Small size",
    ]) {
      expect(html).toContain(`>${heading}<`);
    }
    expect(html).toContain("Les plateformes propriétaires vous louent le produit.");
    expect(html).toContain("Possédez la fabrique.");
    expect(html).not.toMatch(/<script\b/i);
  });

  test("loads exactly one local stylesheet and one local image asset", () => {
    const html = renderReferencePage();

    expect(html.match(/<link\b[^>]*rel="stylesheet"/g) ?? []).toHaveLength(1);
    expect(html.match(/<img\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('href="../src/styles.css"');
    expect(html).toContain('src="../src/assets/libre-ai-mark.svg"');
    expect(html).not.toMatch(/(?:src|href)="https?:\/\/(?!github\.com)/i);
  });

  test("is byte deterministic", () => {
    expect(renderReferencePage()).toBe(renderReferencePage());
  });
});
