# Native Linux Playwright GUID diagnostic implementation plan

**Goal:** Observe the ordering of protocol object creation, disposal and Frame.goto results on native GitHub Linux, without claiming a product fix.

**Architecture:** A dedicated PR diagnostic workflow checks out the historical six-repository composition and verified toolchains. An external Node preload observes the existing Playwright connection without modifying its bundle or message delivery. A bounded supervisor exports only schema-validated opaque protocol records and a reporter's categorical test outcomes; raw logs and traces stay out of artifacts.

**Tech stack:** Existing pinned Node 26.5.0, Bun 1.4.0-canary.1+57f349f63, Playwright 1.61.1, Python 3 standard library and GitHub Actions on ubuntu-24.04. No additional runtime dependencies.

**Spec / provenance:** Owner-authorized investigation following CI run 35219503039 attempts 1/2 and two QEMU experiments. Product base 5ec3630ece2a768872dfb67171c9b7fbf21a1aa9. Tooling 8a27b8f5bf774fad04b8478fa9179eefdba0eaf7. H2 recorded no unknown GUID: 14 pass, 10 timeout, 2 failure; this is not a correction or a causal conclusion.

## Constraints and decisions

- Preserve existing workflow, package scripts, assertions, test timeouts, retry policy and vendor bytes. One starter suite, 26 cases, two workers, zero retries, 900 second external deadline plus 10 second termination grace.
- Diagnostic revision and product revision are separate. Diagnostic workflow results never qualify composition/validate or any required product check.
- Only public pinned composition sources; checkout credentials not persisted; contents: read; no secrets, sudo, privileged container, new provider or VM.
- Browser installation uses the pinned installed CLI without --with-deps. Missing native libraries fail preparation explicitly; there is no silent elevation or runtime substitution. Runner image evolves; record its version and hash rather than claim a pinned OS image.
- Test process receives an allowlisted environment; no GitHub token or artifact credentials. This is a privacy boundary, not a network sandbox: native runner networking remains enabled.
- No URL, headers, cookies, bodies, raw GUIDs, test titles, error text or raw command output in diagnostic evidence. Raw traces may be created by the unchanged product configuration but never exported.
- Bound protocol events, alias/call tables, string inputs, process journal slots and bytes. Saturation/incomplete output is explicit. Journal writes cannot throw into Playwright transport; native observation is still a timing perturbation.
- All uploads come from a fresh sanitized directory after strict schema validation. Never upload a glob over product test-results.

## Review focus

1. Nested or unexpected private protocol data: output must contain only closed enums and bounded primitive values.
2. Ancestor disposal and delayed goto reply: opaque parent/RPC relations must survive without fabricating a direct child disposal event.
3. Observer failures or saturation: preserve transport behavior, mark evidence incomplete and keep product exit status distinct.
4. Worker failure/cancellation: preserve completed journals, bound process execution, distinguish incomplete diagnostics from passing tests.
5. Wrong product/toolchain/bundle or unsafe artifact files: refuse before execution or export, without raw exception output.

## Task 1 — opaque observer and evidence schema

Files: `scripts/diagnostics/protocol.cjs`, `scripts/diagnostics/diagnostic.test.cjs`.
Interface: `createRecorder({present, clock}) -> {observe, snapshot}`; `attach(client, server, recorder)` delegates original handlers exactly; `validateJournal(value)` rejects unknown keys/values. A preload activates only for explicit diagnostic paths and pinned Node/vendor bytes.

- [x] Write tests before implementation: nested secret marker absent; create/parent/dispose/result relation; invalid messages ignored; saturation explicit; safe snapshot detached from recorder; attach preserves receiver/return/throw and event order.
- [x] Run pinned Node `--test scripts/diagnostics/diagnostic.test.cjs`; expect missing recorder assertions to fail, preserve RED evidence externally.
- [x] Implement fixed enum projection and bounded stores; atomic bounded slot files; catch observer I/O errors without changing protocol results. Reject unsupported bundle/runtime before installing hooks.
- [x] Run tests and actual installed Playwright transport integration (synthetic Request/Response disposal; no browser needed), assert original bundle SHA unchanged and callback behavior unchanged.

## Task 2 — safe test outcomes and bounded execution

Files: `scripts/diagnostics/reporter.cjs`, `scripts/diagnostics/run.cjs`, same test file.
Interface: reporter writes only test ordinals/project enums/status/duration/retry counts and final status; supervisor takes canonical composition and fresh output directory, records pins and runs the fixed recipe once.

- [x] Add RED tests injecting private titles/errors/attachments/stdout and malformed artifacts; expect absence of private content, rejection of extra keys, bounds enforcement.
- [x] Add RED subprocess tests: natural nonzero exit preserved, timeout process group terminated, no child stdout/stderr export, environment excludes secret markers.
- [x] Implement allowlisted environment, fixed CLI arguments, deadline, strict export validation, separate execution/diagnostic completeness status. Reuse default product output directory so existing failure summarizer remains meaningful, but discard its raw stdout/stderr.
- [x] GREEN tests plus coverage report; do not equate synthetic transport tests with the missing native browser run.

## Task 3 — opt-in PR native workflow and usage contract

Files: `.github/workflows/playwright-guid-diagnostic.yml`, `docs/playwright-guid-diagnostic.md`.

- [x] Pin actions/checkout and upload-artifact to full commits. Keep trigger pull_request only with diagnostic paths, exact repository and feat/forge-realization head, no user-controlled commands or refs, explicit contents: read and 35 minute job deadline.
- [x] Reuse immutable composition preparation and verified toolchain installer; frozen installs and existing root gate; install browsers without privilege escalation. Run diagnostic tests then fixed supervisor recipe once.
- [x] Upload sanitized directory only on successful sanitization, including when the test process failed; preserve failure status, seven day artifact retention.
- [x] Document exact invocation, source pins, enum schema, incomplete conditions, ordering interpretation, runner/dependency/network limitations and distinction from required checks.
- [x] Validate YAML, run focused tests/coverage, existing root checks and project unit suite in exact prepared dependency context. Hash recipe/inputs and show existing product files unchanged. Local DCO-signed commit (`git commit -s`) only after checks; independent review before any push.

## Recorded ruling — trigger eligibility

A new workflow_dispatch file must exist on the default branch to receive that event. Parent therefore authorized a distinct pull_request diagnostic on the exact same-repository feat/forge-realization head. Checkout its immutable head SHA (not the merge SHA); product stays at 5ec3630. No main change or required-check substitution. Source: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch .

## Final implementation rulings and evidence boundary

- Independent coordinator review found two partial-evidence risks. Observer exceptions now set a sticky incomplete marker (fault injection RED→GREEN); a killed preload leaves an incomplete journal. Worker identity is read at persistence because Playwright assigns TEST_WORKER_INDEX after Node preloads (installed source and RED→GREEN test).
- The smallest authorized cleanup solution records observation and cleanup separately. Known launcher-group descendants receive bounded TERM/KILL even after normal launcher exit. Detached browser descendants remain unverified; runner teardown pending. The diagnostic deliberately returns exit 2 on successful product tests and never declares diagnosticComplete/productGateQualified. No subreaper, privilege, VM or general execution framework was added.
- Coverage thresholds for this new diagnostic are 80% lines/branches/functions. A preliminary exploratory 90% function threshold failed; the enforced 80/80/80 threshold is stated explicitly, with the Linux main/preflight path not locally covered. Product coverage gates remain unchanged.
- Native PR execution, hosted runner dependencies and actual detached-browser cleanup remain unqualified. No browser suite was rerun while preparing this candidate. The candidate is ready for independent review, not a resolved GUID defect.
