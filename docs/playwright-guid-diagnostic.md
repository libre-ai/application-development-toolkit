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
presence, and error presence. The lifecycle journal uses schema v4; its additional
closed categories record internal close/kill, transport close, browser disconnect,
child-process exit/close, and worker signal/exit events. Process values are reduced
to zero/nonzero/none/other and a fixed signal enum. Browser events use the same
opaque alias; worker lifecycle events have no Browser object. No PID is retained. Browser identity is categorized from the actual
Browser create initializer only when its version matches the known pin:
Chromium 149.0.7827.55/revision 1228, Firefox 151.0/revision 1532,
WebKit 26.5/revision 2311. Unknown versions remain `unknown`.

`tests.json` contains ordinal, fixed project enum, worker index, status,
duration, retry count and a coarse error category for each finished test.
It never stores test names, locations, errors or attachments. `unknown-guid`
is an error-message classifier, not proof of the causal protocol order. Schema v2
also distinguishes `missing-system-dependencies`, `missing-browser-executable`,
and `target-closed`; all other text becomes `other`. These categories inspect at
most16 messages of at most65536 characters, never serialize messages or stacks,
and preserve unknown-guid precedence when more than one error is present.
`receipt.json` binds inputs, diagnostic revision, script hashes, toolchain,
runner image version when recognized, duration, exit, observation completeness and process-cleanup limits.

Limits: 64 journal slots, 4096 retained events per process, 8192 object aliases,
1024 pending goto calls, 64 Browser hook attachments per process,
128-character internal identities, 1 MiB per input
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
now reuses the existing product CI command `playwright install --with-deps
chromium firefox webkit`. It installs native system packages on the disposable
hosted runner using the product recipe, which can invoke elevation there. This
is an explicit setup change from cf758b0: that run downloaded WebKit but warned
about35 missing libraries, then recorded five immediate unclassified failures.
System package versions depend on the runner repositories; this is not an
immutable OS/dependency snapshot. No repository/token permission was expanded.
The probe builds the product then runs the starter suite directly, without the
preceding UI/bun-app browser suites from the original full CI job. This and the
observer/reporter are experimental differences. The QEMU H2 run found no missing
GUID (14 pass, 10 timeout, 2 failures); it neither explains nor fixes native CI.

## Lifecycle successor and causal limits

Native run36531698964 at cf758b0 observed creation of a Response, ancestor
disposal and then a client goto result referencing the absent Response. No
client close of those ancestors preceded the result. The server closure trigger
was not observed. Run36531699532 separately failed the product gate on a CSRF
goto GUID; its lack of these journals precludes an identical causal attribution.

The successor attaches to each registered server Browser when its create message
is sent. It wraps existing Browser methods, browserProcess.close/kill, the
verified PipeTransport own _onclose callback and ChildProcess.emit. It avoids
the transport setter, which can invoke a callback on assignment. Worker signals
are observed through existing emit delivery without adding signal listeners.
Each wrapper preserves receiver, arguments, return and thrown identity, adds no
await, and marks observation incomplete on an unsupported hook or recorder error.
A process already exited at attachment is recorded as such and incomplete.
Events before Browser attachment cannot be reconstructed. A killed worker may
never emit a JavaScript exit or signal event.

An internal-close/process-close-request before disconnect identifies an observed
request path; it does not identify the requester. An exit signal/nonzero code
may support a crash hypothesis but is not itself a crash verdict. A pipe closure
without a process event is an unexplained disconnect. Child events are observed
at Node emit entry, not at the physical OS event time. Event order across workers
is not comparable. Neither a target-closed error nor a missing Response is
converted to success.

Compared with cf758b0, this experiment changes instrumentation and native-library
setup. The source/toolchain/browser pins, 26 scenarios, two workers, zero retries,
timeouts, product assertions and global deadline remain fixed. Synthetic tests
exercise real installed BrowserDispatcher registration and close behavior with
synthetic process/transport fixtures; they launch no browser. The lifecycle
hooks still require independent review and a native PR run for qualification.
`diagnosticComplete` remains false while detached-process cleanup is unverified.

## Bounded Chromium stderr successor

Run36534891880 at f1d5755 observed two Chromium process exits with SIGTRAP after
pipe close, including one missing Response GUID. No internal close or worker
signal preceded those closures. The existing evidence does not identify why the
process trapped: raw child output was discarded. This successor observes only
closed stderr categories to distinguish possible families; it is not a GUID fix.

The observer wraps the existing Chromium ChildProcess.stderr.emit method. It
adds no consumer/listener and never calls read, resume, pause or setEncoding.
Data chunks reach the original readline consumer with their exact identity;
return values, receiver, arguments and thrown consumer errors remain unchanged.
Only Chromium version149.0.7827.55 is in scope. Firefox/WebKit lifecycle remains
observed but their stderr is not classified. Bytes emitted before Browser
attachment are outside the observation window and cannot be reconstructed.

The catalogue has seven families and eleven fixed codes:

| Family | Accepted code or source marker |
| --- | --- |
| fatal | `chromium-fatal`: FATAL severity in a structured Chromium header |
| check | `chromium-check`, `v8-check`: anchored known CHECK prefix |
| assertion | `native-assertion`: anchored assertion prefix present in the binary |
| oom | `v8-process-allocation`, `v8-heap-allocation`, `native-out-of-memory`: fixed allocation messages |
| sandbox | `sandbox-unusable`: known sandbox refusal literal |
| zygote | `zygote-host-site`, `zygote-site`: fixed native log source families |
| crashpad | `crashpad-client-site`: fixed native client log source family |

The parser never exports a header, source path, expression, message, PID, URL,
stack, argument, arbitrary errno, raw-data hash or matched substring. Console
lines are not accepted as native headers. Unknown text is discarded and counted
in `unknownLines`, not silently treated as a recognized cause. Log-site categories
say which family emitted text; they do not mean that family caused the failure.
The catalogue is intentionally finite, not a taxonomy of Chromium failures.

Formats are justified by the pinned Chromium
[logging source](https://github.com/chromium/chromium/blob/149.0.7827.55/base/logging.cc)
and [CHECK source](https://github.com/chromium/chromium/blob/149.0.7827.55/base/check.cc),
plus static marker inspection of the exact Linux Chrome archive selected by
Playwright. The Chromium executable SHA256 must be
`2d18db9d8608b052b6a552ee00ec1e830f93692e928b65ecc67d693bd33fe801`.
The supervisor verifies it with streaming reads before the experiment and again
when checking unchanged inputs afterwards. No binary hashing runs inside an
event hook. Receipt schema v2 includes `chromiumExecutableSha256`; no new binary,
version, browser flag, source pin or system-library recipe is introduced.

Per Browser bounds:256KiB inspected bytes,256 completed lines,4096 bytes per
line. Chunk boundaries are reassembled only within that line limit. Overlong
lines, byte/line saturation, unsupported chunk types, stream close before end,
missing/nonwritable hooks and observation faults set sticky incomplete. A prefix
cut by the byte bound is not classified as a complete line. The stderr-state
events record attached/ended and bounded bytes/lines/unknownLines counters. A
pending stream makes snapshots incomplete; validation rejects a complete journal
with a pending stderr stream. Existing4096-event,64-hook,8192-alias and1MiB file
bounds remain active. All new fields use exact keys, integer bounds and enum pairs.

Synthetic tests verify projection, split chunks, overflow, unknown categories,
strict export, actual Readable/readline and real synthetic ChildProcess stderr
without changing consumer bytes or exit behavior. The exact Linux binary was
read and hashed statically on macOS; it was not executed. The new parser/hooks
still need independent review and the native PR experiment for qualification.
Text classification adds synchronous work and can perturb timing. A missing
known marker cannot exclude unknown formats, omitted startup bytes or a signal
with no stderr text. No category alone establishes a crash or a specific CHECK.
`diagnosticComplete=false` and detached-cleanup limitations are unchanged.
