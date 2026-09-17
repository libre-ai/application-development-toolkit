import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { JournalApp } from "./journal-app";

describe("JournalApp (SSR)", () => {
  test("SSR baseline: renders journal shell without auth state", () => {
    const html = renderToStaticMarkup(<JournalApp />);

    // Skip link helper text present (rendered as text content)
    expect(html).toContain("main-content");

    // Main structure
    expect(html).toContain('data-testid="journal-root"');
    expect(html).toContain("Journal souverain");

    // Dev issuer notice visible in SSR
    expect(html).toContain("Connexion de démonstration");
    expect(html).toContain("jamais en production");

    // Login control in enhanced-only (not visible to no-JS users)
    expect(html).toContain("lai-enhanced-only");
    expect(html).toContain("Se connecter");

    // No inline styles
    expect(html).not.toMatch(/style="/);

    // Authenticated-only fragments absent from SSR
    expect(html).not.toContain('data-testid="note-list"');
    expect(html).not.toContain("Déconnexion");
    expect(html).not.toContain("Valider un document");
  });

  test("SSR: structure intact, page usable without JS", () => {
    const html = renderToStaticMarkup(<JournalApp />);

    // Main content accessible
    expect(html).toContain("Accès au journal");
    expect(html).toContain("Authentifiez-vous");

    // Footer present
    expect(html).toContain("Aucun cookie distant");

    // No form data present
    expect(html).not.toMatch(/value="[^"]*\d{4}-\d{2}-\d{2}T/);
  });
});
