<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# Journal application example

An example application for signing in, adding notes and trying contract validation. It includes server-rendered pages and browser tests for login, forms and refusal of unauthenticated requests.

After preparing the toolkit dependencies from the [repository root](../../../README.md), run these commands **from that root**:

```sh
bun run --cwd packages/starter/starter build
bun run --cwd packages/starter/starter start
```

Open `https://127.0.0.1:3000`. The development server generates a temporary self-signed certificate; the browser will not trust it by default.

Tests require Python 3 alongside Bun and the browser dependencies. Failed browser tests print a redacted diagnostic summary and retain their failing exit code.

```sh
bun run --cwd packages/starter/starter test
bun run --cwd packages/starter/starter test:e2e
```

The server uses a development identity provider and in-memory stores. Restarting it loses state. Replace these services before using the example with real users or durable data.

Start adapting `src/ui/journal-app.tsx` and `src/domain/journal.ts` for your application.
