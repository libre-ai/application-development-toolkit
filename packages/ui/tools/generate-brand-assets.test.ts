import { describe, expect, test } from "bun:test";

import { BRAND_MARK_PARTS, BRAND_MARK_VIEW_BOX } from "../src/brand-geometry";
import { renderBrandMarkSvg, validateBrandAssetPublication } from "./generate-brand-assets";

const CANDIDATE_MARK_SHA256 = "a".repeat(64);

describe("workshop gantry asset", () => {
  test("uses three compact orthogonal integer-grid parts", () => {
    expect(BRAND_MARK_VIEW_BOX).toBe("0 0 24 24");
    expect(BRAND_MARK_PARTS).toHaveLength(3);
    expect(BRAND_MARK_PARTS.every((path) => /^[0-9 MHVZ]+$/.test(path))).toBe(true);
  });

  test("renders an inert standalone SVG", () => {
    const svg = renderBrandMarkSvg();
    const forbidden = [
      /<script/i,
      /foreignObject/i,
      /href\s*=/i,
      /url\s*\(/i,
      /gradient/i,
      /filter/i,
      /style\s*=/i,
      /(?:href|src)\s*=\s*["']https?:\/\//i,
      /data:image/i,
      /<metadata/i,
      /\son[a-z]+\s*=/i,
    ];

    expect(svg.match(/<path\b/g) ?? []).toHaveLength(3);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg.match(/https?:\/\//g) ?? []).toEqual(["http://"]);
    expect(forbidden.filter((pattern) => pattern.test(svg))).toEqual([]);
    expect(renderBrandMarkSvg()).toBe(svg);
  });

  test("blocks publication until both owner controls are accepted", () => {
    expect(
      validateBrandAssetPublication({
        approval: `License approval: pending

- Candidate mark SHA-256: \`${CANDIDATE_MARK_SHA256}\``,
        candidateMarkSha256: CANDIDATE_MARK_SHA256,
        similarityReview: `Status: pending

- SHA-256: \`${CANDIDATE_MARK_SHA256}\``,
      }),
    ).toEqual(["brand.asset_license_not_accepted", "brand.asset_similarity_review_not_accepted"]);

    expect(
      validateBrandAssetPublication({
        approval: `License approval: owner-accepted

- Candidate mark SHA-256: \`${CANDIDATE_MARK_SHA256}\``,
        candidateMarkSha256: CANDIDATE_MARK_SHA256,
        similarityReview: `Status: accepted

- SHA-256: \`${CANDIDATE_MARK_SHA256}\`

Disposition: owner-accepted`,
      }),
    ).toEqual([]);
  });

  test("does not interpret acceptance examples in the review body as approval", () => {
    expect(
      validateBrandAssetPublication({
        approval: `# Approval

License approval: pending

- Candidate mark SHA-256: \`${CANDIDATE_MARK_SHA256}\``,
        candidateMarkSha256: CANDIDATE_MARK_SHA256,
        similarityReview: `# Review

Status: pending

- SHA-256: \`${CANDIDATE_MARK_SHA256}\`

## Acceptance control

\`\`\`text
Status: accepted
Disposition: owner-accepted
\`\`\`
`,
      }),
    ).toEqual(["brand.asset_license_not_accepted", "brand.asset_similarity_review_not_accepted"]);
  });

  test("rejects approvals bound to another candidate", () => {
    expect(
      validateBrandAssetPublication({
        approval: `License approval: owner-accepted

- Candidate mark SHA-256: \`${"b".repeat(64)}\``,
        candidateMarkSha256: CANDIDATE_MARK_SHA256,
        similarityReview: `Status: accepted

- SHA-256: \`${"b".repeat(64)}\`

Disposition: owner-accepted`,
      }),
    ).toEqual([
      "brand.asset_license_candidate_mismatch",
      "brand.asset_similarity_candidate_mismatch",
    ]);
  });
});
