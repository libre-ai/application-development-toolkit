# Workshop Gantry Mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the constructed swift candidate with the approved Workshop Gantry mark while preserving public component interfaces and fail-closed publication controls.

**Architecture:** `src/brand-geometry.ts` remains the single geometry source consumed by both React and the standalone SVG generator. Generated assets and reference pages remain committed, deterministic projections; qualification documents bind their decisions to the exact generated SVG hash.

**Tech Stack:** Bun 1.4, strict TypeScript, React 19 server rendering, SVG path data, Playwright 1.61.

**Spec:** `docs/superpowers/specs/2026-09-09-workshop-gantry-mark-design.md`

## Global Constraints

- Preserve `BRAND_MARK_VIEW_BOX`, `BRAND_MARK_PARTS`, `BrandMark`, and `BrandLockup` interfaces.
- Keep exactly three integer-grid paths using only `M`, `H`, `V`, and `Z` commands.
- Keep the canonical SVG inert, deterministic, local, and monochrome through `currentColor`.
- Keep license and similarity publication controls pending and fail-closed.
- Remove active constructed-swift and martinet language from canonical documentation and references.
- Add no dependency and no runtime script.

---

### Task 1: Canonical orthogonal geometry

**Files:**
- Modify: `tools/generate-brand-assets.test.ts:6-11`
- Modify: `src/brand-geometry.ts:1-7`
- Regenerate: `src/assets/libre-ai-mark.svg`

**Interfaces:**
- Consumes: `BRAND_MARK_VIEW_BOX: "0 0 24 24"` and `BRAND_MARK_PARTS: readonly string[]`.
- Produces: three orthogonal Workshop Gantry paths for `BrandMark` and `renderBrandMarkSvg()`.

- [x] **Step 1: Write the failing geometry test**

```ts
test("uses three compact orthogonal integer-grid parts", () => {
  expect(BRAND_MARK_VIEW_BOX).toBe("0 0 24 24");
  expect(BRAND_MARK_PARTS).toHaveLength(3);
  expect(BRAND_MARK_PARTS.every((path) => /^[0-9 MHVZ]+$/.test(path))).toBe(true);
});
```

- [x] **Step 2: Verify RED**

Run: `bun test tools/generate-brand-assets.test.ts`

Expected: FAIL because the constructed swift uses diagonal `L` commands.

- [x] **Step 3: Implement the approved geometry**

```ts
export const BRAND_MARK_PARTS = [
  "M2 3H16V7H6V21H2Z",
  "M18 3H22V21H18Z",
  "M10 10H15V16H10Z",
] as const;
```

- [x] **Step 4: Verify GREEN and regenerate the standalone SVG**

Run: `bun test tools/generate-brand-assets.test.ts`

Expected: 4 tests pass with no warning.

Run: `bun run generate:brand-assets`

Expected: `Generated src/assets/libre-ai-mark.svg.`

- [x] **Step 5: Commit the geometry increment**

```sh
git add tools/generate-brand-assets.test.ts src/brand-geometry.ts src/assets/libre-ai-mark.svg
git commit -m "feat: replace swift with workshop gantry mark"
```

### Task 2: Canonical language and deterministic references

**Files:**
- Modify: `README.md:16-20`
- Modify: `brand/build-reference.tsx:117-120`
- Modify: `color-system/palettes.ts:275-289`
- Regenerate: `brand/reference.html`
- Regenerate: `color-system/generated/convergence/README.md`

**Interfaces:**
- Consumes: the Workshop Gantry naming and monochrome usage rules from the design spec.
- Produces: human documentation and generated reference surfaces without stale swift terminology.

- [x] **Step 1: Replace active identity language at its authored sources**

Use “Workshop Gantry identity” in the package README, “portique” in the French do-not-use guidance,
and describe jade continuity without referring to the retired swift in `color-system/palettes.ts`.

- [x] **Step 2: Demonstrate generated drift**

Run: `bun run check:brand-reference`

Expected: FAIL with `brand.reference_drift` after the authored reference copy changes.

Run: `bun run check:colors`

Expected: FAIL because the convergence README no longer matches its palette source.

- [x] **Step 3: Regenerate deterministic references**

Run: `bun run build:brand-reference`

Expected: `Generated brand/reference.html.`

Run: `bun run generate:colors`

Expected: generated color assets and adopted theme are current.

- [x] **Step 4: Verify focused generators**

Run: `bun run check:brand-reference && bun run check:colors`

Expected: both checks pass with no warning.

- [x] **Step 5: Commit the documentation increment**

```sh
git add README.md brand/build-reference.tsx brand/reference.html color-system/palettes.ts color-system/generated
git commit -m "docs: align brand references with workshop gantry"
```

### Task 3: Candidate-bound qualification evidence

**Files:**
- Modify: `evidence/BRAND-MARK-SIMILARITY-REVIEW.md:1-68`
- Modify: `evidence/BRAND-ASSET-PUBLICATION-APPROVAL.md:1-12`
- Modify: `tools/generate-brand-assets.ts:1-92`
- Test: `tools/generate-brand-assets.test.ts:36-110`

**Interfaces:**
- Consumes: SHA-256 of the regenerated `src/assets/libre-ai-mark.svg`.
- Produces: exact candidate binding, enforced against the current SVG, while preserving pending owner controls.

- [x] **Step 1: Compute the candidate hash**

Run: `shasum -a 256 src/assets/libre-ai-mark.svg`

Expected: one SHA-256 value followed by the canonical SVG path.

- [x] **Step 2: Update the evidence truthfully**

Rename the review to Workshop Gantry, describe its open orthogonal construction, replace every named
comparison with the revised structural comparison, and record the new SVG hash in both documents.
State that the GitLab named-reference signal is reduced by the redesign while official registry and
LaSuite checks remain incomplete. Do not add `Disposition: owner-accepted` or change either pending
status.

- [x] **Step 3: Add a failing candidate-binding test**

Pass a current candidate SHA-256 alongside documents whose accepted controls record a different
SHA-256. Expect `brand.asset_license_candidate_mismatch` and
`brand.asset_similarity_candidate_mismatch`. Verify RED because the existing gate ignores hashes.

- [x] **Step 4: Enforce the exact candidate binding**

Compute the current SVG SHA-256 during `--publication-check`. Require each Markdown control to contain
that exact lower-case digest inside its canonical backtick delimiters. Verify the focused test suite
passes with five tests and no warning.

- [x] **Step 5: Verify publication remains blocked for both reasons**

Run: `bun run check:brand-publication`

Expected: non-zero exit with exactly:

```text
brand.asset_license_not_accepted
brand.asset_similarity_review_not_accepted
```

- [x] **Step 6: Commit the evidence and gate increment**

```sh
git add evidence/BRAND-MARK-SIMILARITY-REVIEW.md evidence/BRAND-ASSET-PUBLICATION-APPROVAL.md tools/generate-brand-assets.ts tools/generate-brand-assets.test.ts
git commit -m "fix: bind brand approvals to the exact candidate"
```

### Task 4: Full qualification and visual inspection

**Files:**
- Verify: all tracked files
- Inspect: Playwright disposable screenshot `test-results/**/brand-reference.png`

**Interfaces:**
- Consumes: all preceding committed increments.
- Produces: reproducible green gate evidence and a human small-size visual check.

- [x] **Step 1: Stage plan and specification for tree-walking scanners**

```sh
git add docs/superpowers/specs/2026-09-09-workshop-gantry-mark-design.md docs/superpowers/plans/2026-09-09-workshop-gantry-mark.md
```

- [x] **Step 2: Run the complete repository gate**

Run: `bun run check`

Expected: lint, strict types, generated-asset checks, security scans, and all unit tests pass with zero warnings.

- [x] **Step 3: Run the complete browser gate**

Run: `bun run test:e2e`

Expected: all applicable Chromium, Firefox, WebKit, no-JS, reduced-motion, and forced-color tests pass; declared project-specific skips only.

- [x] **Step 4: Inspect the Chromium screenshot**

Open the generated `brand-reference.png` at original resolution. Confirm separate gantry parts at 16,
24, 48, and 96 pixels, no clipping, and unchanged lockup legibility.

- [x] **Step 5: Commit the plan and specification**

```sh
git commit -m "docs: record workshop gantry implementation plan"
```
