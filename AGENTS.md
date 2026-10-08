# Application Development Toolkit Agent Rules

## Authority

Shared UI, web platform, testing and starter foundations, couche 4 brick of
the Libre AI constellation. Doctrine lives upstream:
https://raw.githubusercontent.com/libre-ai/project-governance/HEAD/AGENTS.md

## Boundaries

- Contract shapes are canonical in `libre-ai/schemas-and-contracts`, never
  redefined here.
- Product code and product specifications live in their own repositories;
  packages here keep their own names, imports and versions.
- Nothing is published to npm; templates use development services only.
- The Playwright GUID diagnostic (`docs/playwright-guid-diagnostic.md`) is
  an observation, not a product gate: its pinned composition tooling and its
  `observe-native-linux` red are deliberate, never "fixed".

## Quality gates

Install through the shared local composition (README), then run
`bun run check`; `bun run check:e2e` for browser flows. Never hide a red test.

## Agents

- Read actual state before editing.
- Stage files before running tree-walking gates.
- Security > quality > performance > completeness.
