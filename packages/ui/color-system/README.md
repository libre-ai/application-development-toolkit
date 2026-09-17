# Libre AI color system

This directory contains four non-normative explorations and the adopted Envol
constructif convergence. The adopted palette deterministically generates
`src/tokens.css`; production components consume that file and never import an
exploration directory.

## Source and generated artifacts

- `palettes.ts` owns the named directions, OKLCH anchors, risks and evaluation scores.
- `color.ts` owns deterministic OKLCH gamut mapping, sRGB fallbacks, WCAG contrast and
  color-vision screening primitives.
- `system.ts` owns primitive scales, semantic roles, component mappings and visualization ramps.
- `generate.ts` produces the DTCG JSON, CSS, Tailwind CSS 4.3 configuration,
  audits, reports and previews under `generated/`.
- `adopt.ts` projects only `CONVERGENCE` into the production `src/tokens.css`
  file and provides a byte-drift check.
- `color-system.test.ts` verifies scale completeness, gamut safety, semantic coverage, critical
  contrast, code/diff readability and categorical screening.
- `generated-assets.test.ts` validates generated tokens against the pinned official DTCG 2025.10
  schema, then verifies audits, Tailwind 4.3 compilation and preview constraints.
- `third_party/dtcg-format-2025.10/` (repo root) contains that schema and its upstream license notice for deterministic offline checks.

The generated reports are in [`generated/README.md`](./generated/README.md).

## Commands

```sh
bun color-system/generate.ts
bun color-system/adopt.ts
bun run check:colors
bun test color-system/*.test.ts
```

## Adoption decision

The owner selected Envol constructif on 2026-09-09 under the Governance
ADR-0032 candidate. Jade carries brand and primary action; iris remains a rare
secondary role; graphite carries surfaces; jade and iris never form a gradient.
The four initial directions remain non-normative research. Browser evidence and
figurative-asset publication have their own independent gates.
