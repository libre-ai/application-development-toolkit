# Playwright validation patch

The workspace pins Playwright Core 1.61.1. Bun applies
`patches/playwright-core@1.61.1.patch` during installation; use the committed lockfile.

`bun run check:playwright` checks the installed starter dependency with four
synthetic protocol cases. The workspace `check` command includes this gate.
It requires the repository-pinned Node 26.5.0. Browser E2E remain separate.

The patch rejects the pending RPC promise when result validation throws.
Upstream removes that callback before validation, leaving the promise unsettled
and throwing outside it. Invalid results remain errors. Event validation is unchanged.

The patch modifies the distributed `lib/coreBundle.js` from the Apache-2.0
Playwright package. Its attribution is retained in the adjacent `.license` file.
The original bundle SHA-256 is
`6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27`;
the patched bundle SHA-256 is
`38511c1916e1950b9f70b4292d94863e8cc923244a5976bc042507f0cf124540`.

This is a validation candidate. Synthetic protocol regression tests and local
browser tests do not establish the cause of every CI failure. Keep the patch only
with passing required CI; reassess it when upgrading Playwright and remove it when
an upstream version passes the same regression tests without it.
