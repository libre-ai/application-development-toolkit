import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { EvidenceLabel, EvidencePanel, OpenFrame, ProjectStatus } from "./evidence";

describe("evidence components", () => {
  test("renders a complete proof with native semantics", () => {
    const markup = renderToStaticMarkup(
      <EvidencePanel
        claim="Logiciels ouverts"
        limitation="Un dépôt public ne prouve pas la disponibilité."
        mechanism="Code et licences publics."
        sourceHref="https://github.com/libre-ai"
        verifiedOn="2026-09-09"
      />,
    );

    expect(markup).toStartWith("<article");
    expect(markup).toContain("<dl");
    expect(markup).toContain("LIMITE");
    expect(markup).toContain('dateTime="2026-09-09"');
    expect(markup).toContain('aria-label="Source externe pour Logiciels ouverts"');
    expect(markup).not.toContain("<script");
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("omits an absent limitation instead of fabricating one", () => {
    const markup = renderToStaticMarkup(
      <EvidencePanel
        claim="Traçabilité"
        limitation={null}
        mechanism="Décisions versionnées."
        sourceHref="https://github.com/libre-ai/governance"
        verifiedOn="2026-09-09"
      />,
    );

    expect(markup).not.toContain("Limite");
  });

  test("rejects unsafe evidence URLs and malformed dates", () => {
    expect(() =>
      renderToStaticMarkup(
        <EvidencePanel
          claim="Traçabilité"
          limitation={null}
          mechanism="Décisions versionnées."
          sourceHref="//example.com"
          verifiedOn="09/09/2026"
        />,
      ),
    ).toThrow();
  });

  test("exposes reusable labels, status and open frames", () => {
    const markup = renderToStaticMarkup(
      <OpenFrame>
        <EvidenceLabel label="ÉTAT" value="usable" />
        <ProjectStatus maturity="usable" status="Actif" verifiedOn="2026-09-09" />
      </OpenFrame>,
    );

    expect(markup).toContain("lai-open-frame");
    expect(markup).toContain("ÉTAT");
    expect(markup).toContain("usable");
  });
});
