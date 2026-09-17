# Portique d'atelier / Workshop Gantry qualification run — 2026-09-10

- Executed at: `2026-09-10T08:33:57Z`
- Candidate SHA-256: `9ae34131a9782349f0d8d8b1939bfc0ed5f00941efaedf9d8a7ee48f08951596`
- Intended Nice classes: 9 and 42
- Verdict: **incomplete — publication remains blocked**

## Small-size and forced-colors qualification

The first browser run found that the CSS class fixed every mark at `1.5em`: the specimen labelled
16 px actually rendered at 24 px. The component now owns its `1.5em` default through SVG dimensions
and preserves explicit caller dimensions. The focused Chromium run then passed 12 scenarios with 2
intentional project skips:

```text
bunx playwright test brand/reference.e2e.ts --project=chromium --project=chromium-forced-colors
12 passed, 2 skipped, 0 failed
```

Both 16 px and 24 px marks rendered at their declared dimensions. Each retained three visible,
non-empty filled parts in normal and forced-colors rendering. The disposable full-page Chromium
capture produced by the test had SHA-256
`21b7f07e9e1ac7dcbf87c828cd8789e089b507a7da3945a68091f5eb7813fe7b`.

This is rendering evidence, not evidence of audience recognition. The 16 px silhouette remains
legible as an open frame, separated upright, and offset inner control block; whether an observer
reads “workshop gantry” without prompting still requires a blinded human recognition sample.

## Official-register execution record

| Register | Official source | Execution result | Consequence |
| --- | --- | --- | --- |
| EUIPO / TMview | https://www.euipo.europa.eu/en/search-ip | The official entry point returned HTTP 403 to the non-interactive reader. The integrated interactive-browser inventory returned zero available backends. No name, class, or image result set was obtained. | Incomplete; no absence claim. |
| INPI Data | https://www.inpi.fr/ressources/propriete-intellectuelle/rechercher-une-marque-base-marques | INPI documents name search as a first identical-search level and recommends its expert similarity service for orthographic, phonetic, and conceptual similarity. Its trademark API requires an authenticated API account; no such credential or interactive browser was available. | Incomplete; no absence claim. |
| WIPO Global Brand Database | https://www.wipo.int/en/web/global-brand-database | WIPO provides name and image-similarity search, but its terms explicitly prohibit automated queries. With no interactive browser backend, no query was executed. | Incomplete; automation was not used to bypass the terms. |

The attempted terms were `Libre AI` and `LibreAI`; the intended image strategies remain conceptual
and shape similarity, filtered to Nice classes 9 and 42. These entries record attempted execution,
not search results.

## LaSuite named-reference closure

The current official LaSuite page exposed
`/_next/static/media/lasuite.26b6f1fd.svg` on 2026-09-10. The retrieved asset had SHA-256
`e24d5be0cae1a8b3cf0336e4e71f257ee1df9030b42f0df718195e0a738d1b47`.

Its device is a blue wordmark with two rounded, colored bracket/chevron forms at opposite corners.
It does not share the candidate's black orthogonal open frame, detached vertical upright, or offset
square control block. The named-reference design signal is low. This visual comparison does not
replace trademark-register similarity results.

## Remaining hard stop

The existing publication contract is unchanged. EUIPO/TMview, INPI, and WIPO searches need
reproducible result captures produced through their permitted interactive interfaces; the named
reference set needs a side-by-side human disposition; and the owner must separately accept the
exact reserved licence. Until then, `check:brand-publication` must fail.
