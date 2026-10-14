# Playwright validation patch

The workspace pins Playwright Core 1.64.0. Bun applies
`patches/playwright-core@1.64.0.patch` during installation; use the committed lockfile.

`bun run check:playwright` checks the installed starter dependency with four
synthetic protocol cases. The workspace `check` command includes this gate.
It requires the repository-pinned Node 26.5.0. Browser E2E remain separate.

The patch rejects the pending RPC promise when result validation throws.
Upstream removes that callback before validation, leaving the promise unsettled
and throwing outside it. Invalid results remain errors. Event validation is unchanged.
Upstream 1.64.0 still ships the unpatched code: its `lib/coreBundle.js` deletes the
callback (line 65438) and then calls the result validator outside any `try`
(line 65450), so the patch is carried forward, re-derived for the 1.64.0 line
offsets. The hunk body is unchanged from the 1.62.1 patch; only its offset moved
from 63496 to 65447.

The patch modifies the distributed `lib/coreBundle.js` from the Apache-2.0
Playwright package. Its attribution is retained in the adjacent `.license` file.
The original 1.64.0 bundle SHA-256 is
`2325ca4c1c83070e89dc49fb82525508f0a68e0cf12e2a624277968da216b7e0`;
the patched bundle SHA-256 is
`5b55e2391e6afe560230c9228098edc37b3e7f5c505a911aa2c09927c18010ac`.

This is a validation candidate. Synthetic protocol regression tests and local
browser tests do not establish the cause of every CI failure. Keep the patch only
with passing required CI; reassess it when upgrading Playwright and remove it when
an upstream version passes the same regression tests without it.

## Why Playwright 1.64.0

Playwright 1.64.0 contains the change that closed microsoft/playwright#42731
(microsoft/playwright#42788, merge `b30584c2`, an ancestor of tag `v1.64.0`): the
first Firefox navigation to a `Cross-Origin-Opener-Policy: same-origin` page no
longer hangs. The starter Firefox projects therefore no longer set
`browser.tabs.remote.useCrossOriginOpenerPolicy=false`, the temporary workaround
carried on 1.62.1.

## Why Playwright 1.62.1 and not 1.61.1 (history)

Playwright 1.61.1 installs Chrome for Testing 149.0.7827.55 (Chromium revision
1228, headless shell revision 1228 as well). On the hosted `ubuntu-24.04` runner
that browser process intermittently dies on `SIGTRAP` during the
`packages/starter/starter` suite (projects `chromium` and `chromium-csrf`). The
client then reports `Object with guid response@... was not bound in the
connection`: the Response object is disposed together with the dead browser, so
the guid error is a consequence of the crash, not a protocol-ordering defect.

Measured on 2026-10-08 in CI probes:

| Playwright runner | Chromium build | Suite runs failing |
| --- | --- | --- |
| 1.61.1 | revision 1228 | 30 of 42 (54 `SIGTRAP`, 54 failed tests) |
| 1.62.1 and 1.63.0 | revisions 1234 and 1243 | 0 of 18 (both versions together) |
| 1.61.1 | revision 1234 | 0 of 6 |

The Chromium build decides the outcome, not the Playwright runner, and no launch
flag removed the crash on revision 1228. Before this change the required check
`composition / validate` failed on 7 of 11 runs of the unchanged base commit.

The sibling `ai-work-supervision` package `@libre-ai/auth-web` still declares
`@playwright/test` 1.61.1 as a development dependency, so the lockfile records a
nested, unpatched 1.61.1 copy under it. Nothing in this workspace resolves that
copy: the `playwright` binary, the browser install and the starter suites all
resolve the hoisted, patched 1.62.1.
