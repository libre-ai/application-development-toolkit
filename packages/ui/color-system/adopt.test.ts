import { describe, expect, test } from "bun:test";

import { ADOPTED_PALETTE_SLUG, buildAdoptedThemeCss } from "./adopt";

describe("adopted color system", () => {
  test("projects Envol constructif into the production semantic tokens", () => {
    const css = buildAdoptedThemeCss();

    expect(ADOPTED_PALETTE_SLUG).toBe("convergence");
    expect(css).toContain("--lai-color-brand-primary: #1e6c49");
    expect(css).toContain("--lai-color-brand-secondary: #5d5483");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).not.toMatch(/linear-gradient|radial-gradient/i);
  });

  test("renders identical bytes for identical palette inputs", () => {
    expect(buildAdoptedThemeCss()).toBe(buildAdoptedThemeCss());
    expect(buildAdoptedThemeCss().endsWith("\n")).toBe(true);
  });
});
