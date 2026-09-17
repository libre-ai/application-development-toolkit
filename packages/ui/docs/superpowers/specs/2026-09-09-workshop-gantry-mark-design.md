# Workshop Gantry Mark Design

## Decision

Libre AI replaces the constructed swift candidate with the **Workshop Gantry** mark. The mark makes
“Possédez la fabrique” structural: an open frame contains a controllable module without enclosing it.

## Canonical construction

- Keep the `0 0 24 24` view box and three independently authored paths.
- Build every edge from horizontal and vertical integer-grid segments.
- Use a left gantry, a separated right upright, and an offset control block.
- Preserve visible gaps between the three parts at 16, 24, 48, and 96 pixels.
- Exclude bilateral animal symmetry, paired pointed upper masses, diagonals, and a centered downward
  point.

The canonical SVG remains monochrome through `currentColor`. A colored application may use jade only
for the control block, but this repository does not add a bicolor component API in this change.

## Preserved interfaces

- `BRAND_MARK_VIEW_BOX` remains `"0 0 24 24"`.
- `BRAND_MARK_PARTS` remains a readonly tuple of three SVG path strings.
- `BrandMark` and `BrandLockup` keep their existing props and accessibility behavior.
- `@libre-ai/ui/brand/mark.svg` keeps its export path and inert standalone SVG contract.

## Documentation and qualification

Replace active “constructed swift” and “martinet” language with “Workshop Gantry” or “portique
d’atelier”. Regenerate the standalone asset, brand reference, and affected color-system documents.
Record the revised SVG SHA-256 in both publication-control documents.
The publication gate recomputes the SVG SHA-256 and rejects either document when its recorded hash
does not bind to the current candidate, even if its owner-control fields are accepted.

The redesign removes the named GitLab silhouette blocker from the official-source pre-screening, but
does not complete EUIPO, INPI, WIPO, or LaSuite review. `Status: pending`, `Disposition` absence, and
`License approval: pending` therefore remain unchanged. Publication must continue to fail closed.

## Verification

- Unit tests prove that all three paths use compact integer-only orthogonal geometry and that the SVG
  renderer remains deterministic and inert.
- Generator checks prove that the committed SVG, reference page, and color-system documents match
  their sources.
- Publication tests prove that accepted controls bound to another SVG remain rejected.
- Playwright verifies accessibility, local-only loading, narrow reflow, contrast, forced colors, and
  the small-size reference across configured engines.
- A Chromium screenshot is inspected at original resolution before completion.
