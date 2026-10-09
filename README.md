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

Follow the [shared local composition guide](https://github.com/libre-ai/project-governance/blob/HEAD/docs/LOCAL-COMPOSITION.md) with target `application-development-toolkit` and the commit to verify. It prepares all siblings and builds UI before consumer installation. From the prepared toolkit root:

```sh
bun run --cwd packages/starter/bun-app build
bun run --cwd packages/starter/bun-app start
```

For browser flows, run `bun run check:e2e` with Playwright browsers installed.

Code is undergoing integration; no package is published to npm. Templates use development services and are not ready for real users. Public use of brand assets retains a separate authorization check.

## Project status

<!-- libre-ai:project-status:begin -->
<!-- Section générée depuis project.v1.yaml — ne pas éditer à la main. -->

- Situation actuelle : Recovered source snapshot 5ec3630ece2a768872dfb67171c9b7fbf21a1aa9 is present. Product tests and CI were not rerun for this documentary integration; historical evidence is not qualification of this tree. No product admission or authority transfer is established. Historical responsibilities were held by libre-ai/ui, a repository since retired.
- Maturité : idea
- Exposition : idea
- Confiance : medium
- Preuves vérifiées le : 2026-10-08
- Avancement : Avancement non calculable — périmètre à clarifier

<!-- libre-ai:project-status:end -->

[Français](README.fr.md)
