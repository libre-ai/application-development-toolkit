<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# web-platform

Web rendering, routing and response helpers for Bun and React.

This package is part of [Application Development Toolkit](../../README.md). Its implementation and tests are in this directory. Run `bun install` at the repository root, then `bun run --cwd packages/web-platform test`.

## Responses, refusals and probes

- `secureResponse(response, cacheControl?)` sets seven security headers, including
  `Strict-Transport-Security: max-age=31536000; includeSubDomains`, and `Cache-Control`
  (`no-store` by default). The transport header is unconditional; a browser ignores it over
  plain HTTP and on an IP address host.
- `problem(status, code, requestId)` builds a `application/problem+json` refusal. `status` is
  one of `PROBLEM_STATUSES` (400, 401, 403, 404, 405, 409, 422, 429, 500, 503); any other
  value throws `web.problem_invalid`, at run time too.
- `createRequestHandler` sets `X-Request-Id` on every response it returns, equal to the
  identifier the application supplied through `requestId`. An `X-Request-Id` sent by the
  client is never used. A route receives the identifier as its third argument.
- `liveRoute()` answers `200 {"status":"ok"}`. `readyRoute(check)` answers
  `200 {"status":"ready"}` when `check` resolves and `503 {"status":"not_ready"}` when it
  rejects or throws, without any detail of the error. The application chooses the paths and
  bounds the duration of `check`: the probe has no timeout.

```ts
import { createRequestHandler, liveRoute, problem, readyRoute } from "@libre-ai/web-platform";

const handler = createRequestHandler({
  requestId: () => `req_${crypto.randomUUID().replaceAll("-", "")}`,
  routes: {
    "/live": liveRoute(),
    "/ready": readyRoute(async () => {
      await database.ping(); // supplied by the application
    }),
    "/private": (_request, _url, requestId) => problem(401, "auth.session_missing", requestId),
  },
});
```

## Hidden characters

`revealHiddenCharacters(text)` returns the text with every zero-width, bidirectional or
control code point replaced by `[U+XXXX]`; TAB and LF are kept. The result is plain text: it
is not HTML-escaped, the renderer does that.

The class is the `removedRanges` table of the candidate served-text preparation vectors of
`libre-ai/schemas-and-contracts`. That candidate is not merged, so the table is a copy, kept
under `fixtures/served-text-preparation-candidate/` and compared to the code by the tests. It
becomes a pinned projection once the candidate is published.
