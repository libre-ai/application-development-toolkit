<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# Web application example

A React page rendered on the server, with local client assets and a useful page when JavaScript is disabled. It also demonstrates a bounded JSON route and offline application assets.

After preparing the toolkit dependencies from the [repository root](../../../README.md), run these commands **from that root**:

```sh
bun run --cwd packages/starter/bun-app build
bun run --cwd packages/starter/bun-app start
```

Open the address printed by the server. To verify the example:

```sh
bun run --cwd packages/starter/bun-app test
bun run --cwd packages/starter/bun-app test:e2e
```

Adapt `src/ui/reference-app.tsx` for your interface and `src/server/handler.ts` for your routes. This is an example to build upon, not a deployed service.
