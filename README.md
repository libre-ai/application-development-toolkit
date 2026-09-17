<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Build a Libre AI application

Shared interface components, web adapters and testing tools so applications can reuse these foundations.

## Packages

| Package | Purpose |
| --- | --- |
| [`@libre-ai/ui`](packages/ui) | React components and shared styles. |
| [`@libre-ai/web-platform`](packages/web-platform) | Server responses, HTML documents and client startup. |
| [`@libre-ai/testing`](packages/testing) | An in-memory PostgreSQL-compatible database for tests. |
| [Application templates](packages/starter) | A web page and journal with development authentication. |

## Try locally

Place `project-governance`, `schemas-and-contracts`, `ai-work-supervision`, `organization-data-lifecycle` and `ai-model-policy` next to this repository. The last two provide declared dependencies of the Auth workspace. Use Bun `1.4.0-canary.1` (revision `57f349f63`), then:

```sh
bun install --cwd ../project-governance --frozen-lockfile --ignore-scripts
bun install --cwd ../schemas-and-contracts --frozen-lockfile --ignore-scripts
bun install --cwd ../ai-work-supervision --frozen-lockfile --ignore-scripts
bun install --frozen-lockfile --ignore-scripts
bun run check
bun run --cwd packages/starter/bun-app build
bun run --cwd packages/starter/bun-app start
```

For browser flows, run `bun run check:e2e` with Playwright browsers installed.

Code is undergoing integration; no package is published to npm. Templates use development services and are not ready for real users. Public use of brand assets retains a separate authorization check.

[Français](README.fr.md)
