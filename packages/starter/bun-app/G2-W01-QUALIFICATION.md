# WP-G2-W01 — Bun React web foundation qualification

- **Checkpoint:** 2026-07-16
- **Status:** completed; human accessibility review accepted on 2026-07-16
- **Runtime:** Bun `>=1.4.0`; qualification evidence uses exact bootstrap Bun `1.4.0-canary.1+57f349f63`
- **Production status:** blocked

## Acceptance map

| Locked acceptance | Evidence |
| --- | --- |
| Direct `Bun.serve` serves SSR, hydration, static and JSON | framework-free handler, server adapter, `/`, `/static`, `/api/health` and nine browser scenarios |
| Keyboard, focus, reduced motion, no-JS and three engines pass | Playwright Chromium, Firefox and WebKit projects plus bounded no-JS/reduced-motion projects |
| No forbidden framework, remote runtime asset or second lockfile | source gate, local-path validation, request audit and one root `bun.lock` |

## Delivered boundaries

- `@libre-ai/design-system`: React Aria button, semantic primitives, CSS tokens and bounded
  Tailwind v4 utility compilation.
- `@libre-ai/web-platform`: deterministic document rendering, hydration, security responses,
  bounded routing and bind-address parsing.
- `@libre-ai/bun-app-template`: direct Bun server, production client build, static output, local
  manifest/service worker/icon and browser fixtures.

No product domain, authentication, storage, secret, telemetry, network dependency or Clever resource
is introduced. The template remains a foundation reference, not a production deployment.

## Security and failure behavior

- local document assets reject schemes, protocol-relative paths, backslashes, controls and spaces;
- CSP, `frame-ancestors 'none'`, MIME sniffing protection, strict referrer policy and a restrictive
  permissions policy are returned by all routes;
- unknown routes, unsupported methods and handler failures use the canonical Problem Details
  envelope without propagating private exception text; request IDs are injected and format-bounded;
- a strict Ajv registry test validates the emitted refusal against `problem-details.v1.schema.json`;
- fixed-name assets use a short cache lifetime rather than an unsafe immutable cache promise;
- the service worker caches only an explicit same-origin allow-list under a full content-derived
  SHA-256 cache key and supports the static shell.

## Verification record

```text
bun run typecheck                             PASS
bun test                                      PASS — 77 tests
bun run --cwd distribution/templates/bun-app build
                                             PASS
Playwright                                    PASS — 9/9
bun run check:licenses                        PASS — 40 package identities
bun audit                                     PASS — no vulnerabilities found
```

Two consecutive builds produced byte-identical output with aggregate SHA-256
`fcd2bdf527ba3d068c4c7c8d5900fb4504a5509d47c9a832d926500c709c9c2b`. The production
client is minified with `NODE_ENV=production`; its size is 421,448 bytes (129,628 bytes through the
local gzip check). The complete root Bun and Rust gates passed immediately before this record.

## Human gate outcome

The repository owner accepted `accessibility-foundation-review` by explicit human disposition on
2026-07-16. The retained product-level manual checks remain documented in
`packages/design-system/evidence/ACCESSIBILITY-FOUNDATION-REVIEW.md`; this acceptance is not a WCAG
certification.

The Bun production gate, G2 foundation acceptance and all Clever Cloud actions remain blocked.
