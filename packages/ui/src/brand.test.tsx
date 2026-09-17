import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandLockup, BrandMark, ProductSignature } from "./brand";

describe("brand identity components", () => {
  test("distinguishes decorative and named marks", () => {
    const decorative = renderToStaticMarkup(<BrandMark accessibleName={null} />);
    const named = renderToStaticMarkup(<BrandMark accessibleName="Libre AI" />);

    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain('role="img"');
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Libre AI"');
    expect(named).toContain("<title>Libre AI</title>");
  });

  test("uses the default mark size without overriding explicit dimensions", () => {
    const defaultMark = renderToStaticMarkup(<BrandMark accessibleName={null} />);
    const smallMark = renderToStaticMarkup(
      <BrandMark accessibleName="16 pixels" height={16} width={16} />,
    );

    expect(defaultMark).toContain('height="1.5em"');
    expect(defaultMark).toContain('width="1.5em"');
    expect(smallMark).toContain('height="16"');
    expect(smallMark).toContain('width="16"');
  });

  test("keeps the organization and product names as text", () => {
    const markup = renderToStaticMarkup(<BrandLockup product="Memo" />);

    expect(markup.match(/Libre AI/g) ?? []).toHaveLength(1);
    expect(markup).toContain("Memo");
    expect(markup).toContain("<span");
  });

  test("renders supplied product facts without inventing marketing state", () => {
    const markup = renderToStaticMarkup(
      <ProductSignature
        maturity="usable"
        name="Libre AI Memo"
        sourceHref="https://github.com/libre-ai/memo"
        status="Actif"
        summary="Mémoire locale et vérifiable."
        verifiedOn="2026-09-09"
      />,
    );

    expect(markup).toContain("Libre AI Memo");
    expect(markup).toContain("usable");
    expect(markup).toContain("Actif");
    expect(markup).toContain('dateTime="2026-09-09"');
  });

  test("rejects unsafe product source URLs", () => {
    expect(() =>
      renderToStaticMarkup(
        <ProductSignature
          maturity="usable"
          name="Libre AI Memo"
          sourceHref="javascript:alert(1)"
          status="Actif"
          summary="Mémoire locale et vérifiable."
          verifiedOn="2026-09-09"
        />,
      ),
    ).toThrow("brand.public_https_url_required");
  });
});
