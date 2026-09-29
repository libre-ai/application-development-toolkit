# Native Linux GUID ordering diagnostic

This workflow investigates the missing Playwright Response GUID from CI run
35219503039. It is **not a fix or a required product check**. The normal Code
validation workflow is unchanged. A successful observation, including a suite
that passes, cannot establish the cause of an intermittent failure.

## Execution and inputs

After independent review, publishing the diagnostic files on the authorized
same-repository `feat/forge-realization` PR enables the separate
`Playwright GUID diagnostic (not a product gate) / observe-native-linux` job.
The trigger is restricted to changes to diagnostic files on that PR head.
There is no `pull_request_target`, branch mutation, required-check replacement
or secret input. The workflow checks out the immutable PR head for diagnostic
code and separately prepares the historical product composition below.

A new `workflow_dispatch` workflow is not used: GitHub requires that workflow
file on the default branch. No default-branch change is needed for this probe.
See [GitHub's event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)
and [pull request events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

| Source | Full commit |
| --- | --- |
| Composition tooling | `8a27b8f5bf774fad04b8478fa9179eefdba0eaf7` |
| Toolkit product | `5ec3630ece2a768872dfb67171c9b7fbf21a1aa9` |
| Governance dependency | `9944bfffbfeddbd9a5c470260de996368818fb87` |
| Contracts | `c53967635a71bfd504da19764bcfc6c6b7d79785` |
| AI work supervision | `9c9e445c994b63638fdf73249cbecaeab720afd6` |
| Organization data lifecycle | `e8050a7202bd827a2dc73999192f791647b1cdc3` |
| AI model policy | `6521c4a94c6477bd82c99ad9f2ee6a3e97385223` |

The existing checksum-verifying installer selects Node 26.5.0 and Bun
1.4.0-canary.1+57f349f63. Frozen installs retain Playwright 1.61.1 and its
existing RPC rejection patch. The observer refuses any other installed bundle
SHA-256 than `38511c1916e1950b9f70b4292d94863e8cc923244a5976bc042507f0cf124540`.
No vendor bundle, test assertion, per-test timeout or retry policy changes.

The experiment runs one starter suite, 26 scenarios, two workers, zero retries.
The supervisor's global bound is 900 seconds, followed by at most 10 seconds of
process-group termination grace. The GitHub job has a 35 minute overall bound.
A setup failure stops before the experiment; timeout is exit 124, incomplete
execution with unverified detached-process cleanup is exit 2, and ordinary product failures retain their exit.
The normal failure summarizer still uses its default output directory.

## Evidence and privacy contract

`events-N.json` contains only a fixed schema: per-process worker index, event
sequence and relative time, closed direction/kind/type/browser enums, integer
object aliases, parent aliases, numeric protocol RPC IDs, boolean response
presence, and error presence. Browser identity is categorized from the actual
Browser create initializer only when its version matches the known pin:
Chromium 149.0.7827.55/revision 1228, Firefox 151.0/revision 1532,
WebKit 26.5/revision 2311. Unknown versions remain `unknown`.

`tests.json` contains ordinal, fixed project enum, worker index, status,
duration, retry count and a coarse error category for each finished test.
It never stores test names, locations, errors or attachments. `unknown-guid`
is an error-message classifier, not proof of the causal protocol order.
`receipt.json` binds inputs, diagnostic revision, script hashes, toolchain,
runner image version when recognized, duration, exit, observation completeness and process-cleanup limits.

Limits: 64 journal slots, 4096 retained events per process, 8192 object aliases,
1024 pending goto calls, 128-character internal identities, 1 MiB per input
file, 65 input files total, 26 test outcomes. Saturation sets `incomplete`;
a ring-buffer prefix loss precludes a full creation/disposal history. Output
is explicitly allowlisted and validated before a fresh sanitized directory is
created. Symlinks, extra files/keys, arbitrary strings and oversized files are
refused. Only that directory is uploaded, with seven day retention.

`observationComplete` describes only finished, untruncated, observed test workers.
`processCleanup.launcherGroup` records whether that process group disappeared;
`detachedDescendants` remains `unverified` and `runnerTeardown` remains `pending`.
Playwright can launch browsers in separate process groups. This candidate does
not claim their cleanup from the launcher's exit, nor implement a general
execution supervisor. It attempts bounded TERM/KILL cleanup of its own launcher
group even after a natural exit. `diagnosticComplete` is always false, and a
passing test suite returns exit 2 until detached-process cleanup is independently
qualified. GitHub's 35 minute job bound remains the final execution boundary.
The uploaded snapshot is not a claim that every surviving process was stopped.

The test subprocess receives an allowlisted environment and no GitHub token,
artifact credentials or arbitrary `NODE_OPTIONS`. Raw stdout/stderr are discarded.
The unchanged Playwright configuration may create raw traces locally on the
ephemeral runner; these are never copied to the artifact. This is not a network
sandbox: native runner networking remains enabled. Only public synthetic inputs
are in scope. No private application input is admissible.

## Interpreting order

Within a worker journal, follow the Response create parent to Request and its
ancestors. Compare their disposal events with the **client-receive** goto result.
A recursive ancestor disposal can remove Response without a separate wire
Response dispose. `responsePresent: false` at that receive boundary is the
missing-object observation; a later close/dispose cannot explain an earlier
missing object. RPC IDs correlate send/receive only inside that connection.
Worker indices correlate journals and finished test outcomes. Relative times
across different processes are not a global ordering oracle.

The observer wraps existing handlers and delegates their exact receiver,
arguments, return and exceptions. It does not insert an await or change the
transport's setImmediate scheduling. Observation and occasional synchronous
journal writes still perturb timing. Missing observation does not disprove the
race. A killed worker may leave an incomplete or empty journal; do not infer
absence of a GUID failure from missing evidence.

## Validation and limits

Run after frozen dependency installation with the pinned Node on PATH:

```sh
TOOLKIT_DIAG_TEST_WORKSPACE="$PWD/packages/starter/starter" node --test \
  --experimental-test-coverage \
  --test-coverage-include='scripts/diagnostics/*.cjs' \
  --test-coverage-exclude='scripts/diagnostics/*.test.cjs' \
  --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 \
  scripts/diagnostics/diagnostic.test.cjs
```

These thresholds are enforced only for the diagnostic scripts; they do not
replace product coverage. Tests include private marker projection, truncation,
strict export, timeout and real installed asynchronous SDK disposal. The native
runner's complete supervisor/preflight path still requires the actual PR run;
local synthetic transport tests and macOS root checks are separate evidence.

`ubuntu-24.04` is a mutable hosted runner label, not an immutable OS image.
Browser binaries are pinned by the installed Playwright revision. Installation
omits `--with-deps` and sudo; missing system libraries block execution explicitly.
The probe builds the product then runs the starter suite directly, without the
preceding UI/bun-app browser suites from the original full CI job. This and the
observer/reporter are experimental differences. The QEMU H2 run found no missing
GUID (14 pass, 10 timeout, 2 failures); it neither explains nor fixes native CI.
