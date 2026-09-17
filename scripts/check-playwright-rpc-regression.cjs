// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

assert.equal(process.version, "v26.5.0", "Node 26.5.0 is required");
const args = process.argv.slice(2);
assert.ok(
	args.length === 0 || (args.length === 2 && args[0] === "--workspace"),
);
const workspace = args.length
	? path.resolve(args[1])
	: path.resolve(__dirname, "..", "packages", "starter", "starter");
const cases = ["control", "dispose", "malformed", "rpc-error"];
const observations = [];
for (const mode of cases) {
	const result = spawnSync(
		process.execPath,
		[
			path.join(__dirname, "playwright-rpc-regression-child.cjs"),
			workspace,
			mode,
		],
		{ encoding: "utf8", timeout: 5_000, maxBuffer: 65_536 },
	);
	let evidence = null;
	let reason = null;
	if (result.error)
		reason =
			result.error.code === "ETIMEDOUT"
				? "child-timeout"
				: "child-process-error";
	else if (result.signal) reason = "child-signal";
	else if (result.status !== 0) reason = "behavior-rejected";
	else if (result.stderr !== "") reason = "unexpected-child-stderr";
	else {
		try {
			evidence = JSON.parse(result.stdout);
			const row = evidence.results[0];
			assert.equal(evidence.results.length, 1);
			assert.equal(row.mode, mode);
			assert.equal(evidence.node, process.version);
			assert.match(evidence.bundleSha256, /^[a-f0-9]{64}$/);
			assert.equal(
				row.expectedExceptions +
					row.unexpectedExceptions +
					row.unhandledRejections,
				0,
			);
			assert.equal(row.callbackRemoved, true);
			assert.equal(row.resolved, mode === "control");
			assert.equal(row.callbackRejected, mode !== "control");
			assert.equal(
				row.rejectedCategory,
				{
					control: null,
					dispose: "unknown-guid",
					malformed: "malformed-channel",
					"rpc-error": "rpc-error",
				}[mode],
			);
		} catch {
			reason = "invalid-child-evidence";
			evidence = null;
		}
	}
	observations.push({ mode, passed: reason === null, reason, evidence });
}
const pins = new Set(
	observations
		.filter((row) => row.passed)
		.map((row) => row.evidence.bundleSha256),
);
const passed = observations.every((row) => row.passed) && pins.size === 1;
process.stdout.write(
	`${JSON.stringify({
		schemaVersion: "playwright-rpc-regression.v1",
		passed,
		scope:
			"Synthetic SDK requests using actual installed Request.response promises and unchanged asynchronous dispatch; no browser or CI-cause claim",
		observations,
	})}\n`,
);
process.exitCode = passed ? 0 : 1;
