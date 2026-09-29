// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { validateJournal, resolveCore, BUNDLE_SHA } = require("./protocol.cjs");
const { validateReport } = require("./reporter.cjs");
const PINS = {
	"project-governance": "9944bfffbfeddbd9a5c470260de996368818fb87",
	"schemas-and-contracts": "c53967635a71bfd504da19764bcfc6c6b7d79785",
	"application-development-toolkit": "5ec3630ece2a768872dfb67171c9b7fbf21a1aa9",
	"ai-work-supervision": "9c9e445c994b63638fdf73249cbecaeab720afd6",
	"organization-data-lifecycle": "e8050a7202bd827a2dc73999192f791647b1cdc3",
	"ai-model-policy": "6521c4a94c6477bd82c99ad9f2ee6a3e97385223",
};
const CHROMIUM_EXECUTABLE_SHA =
	"2d18db9d8608b052b6a552ee00ec1e830f93692e928b65ecc67d693bd33fe801";
async function hashFile(file) {
	const hash = crypto.createHash("sha256");
	for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
	return hash.digest("hex");
}
async function verifyChromiumExecutable(file) {
	const digest = await hashFile(file);
	if (digest !== CHROMIUM_EXECUTABLE_SHA)
		throw new Error("unsupported-chromium-executable");
	return digest;
}
function childEnvironment(source) {
	const result = { CI: "true", LANG: "C.UTF-8", TZ: "UTC" };
	for (const key of ["PATH", "HOME", "TMPDIR", "PLAYWRIGHT_BROWSERS_PATH"])
		if (source[key]) result[key] = source[key];
	return result;
}
async function runBounded(command, args, options, deadlineMs, graceMs) {
	return await new Promise((resolve) => {
		let timedOut = false;
		let launchFailed = false;
		let outcome = { exitCode: null, signal: null };
		let groupCleanupAttempted = false;
		const child = spawn(command, args, {
			...options,
			stdio: "ignore",
			detached: true,
			shell: false,
		});
		function groupExists() {
			if (!child.pid) return false;
			try {
				process.kill(-child.pid, 0);
				return true;
			} catch (error) {
				return error.code !== "ESRCH";
			}
		}
		function kill(signal) {
			if (!child.pid) return;
			try {
				process.kill(-child.pid, signal);
			} catch {
				/* Already gone or unverified; receipt reports the observed state. */
			}
		}
		function finish() {
			child.unref();
			resolve({
				...outcome,
				timedOut,
				launchFailed,
				groupCleanupAttempted,
				groupState: groupExists() ? "unverified" : "absent",
			});
		}
		function cleanup() {
			if (groupCleanupAttempted) return;
			groupCleanupAttempted = true;
			kill("SIGTERM");
			// Reserve the last 50ms for reaping; a stuck process never extends the bound.
			setTimeout(() => kill("SIGKILL"), Math.max(0, graceMs - 50));
			setTimeout(finish, graceMs);
		}
		const deadline = setTimeout(() => {
			timedOut = true;
			cleanup();
		}, deadlineMs);
		child.once("error", () => {
			launchFailed = true;
		});
		child.once("close", (exitCode, signal) => {
			clearTimeout(deadline);
			outcome = {
				exitCode,
				signal: ["SIGTERM", "SIGKILL", null].includes(signal)
					? signal
					: "other",
			};
			if (groupCleanupAttempted) return;
			if (groupExists()) cleanup();
			else finish();
		});
	});
}
function exportEvidence(raw, destination) {
	const entries = fs.readdirSync(raw);
	if (entries.length > 65 || fs.existsSync(destination))
		throw new Error("invalid-evidence-directory");
	const accepted = [];
	let bytes = 0;
	for (const name of entries) {
		if (!/^(events-(?:[0-9]|[1-5][0-9]|6[0-3])|tests)\.json$/.test(name))
			throw new Error("unexpected-evidence-file");
		const file = path.join(raw, name);
		const stat = fs.lstatSync(file);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1048576)
			throw new Error("unsafe-evidence-file");
		bytes += stat.size;
		if (bytes > 65 * 1048576) throw new Error("evidence-byte-limit");
		const value = JSON.parse(fs.readFileSync(file, "utf8"));
		if (
			!(name === "tests.json" ? validateReport(value) : validateJournal(value))
		)
			throw new Error("invalid-evidence-schema");
		accepted.push({ name, value });
	}
	fs.mkdirSync(destination, { mode: 0o700 });
	for (const { name, value } of accepted)
		fs.writeFileSync(path.join(destination, name), JSON.stringify(value), {
			mode: 0o600,
		});
	return accepted;
}
function diagnosticComplete(inputsUnchanged, result, journals, tests) {
	if (
		!inputsUnchanged ||
		result.timedOut ||
		result.launchFailed ||
		journals.length === 0 ||
		journals.some((row) => row.value.incomplete) ||
		tests?.expected !== 26 ||
		tests.tests.length !== 26 ||
		tests.incomplete ||
		tests.finalStatus === null
	)
		return false;
	const workers = new Set(tests.tests.map((row) => row.workerIndex));
	if (workers.has(null) || workers.has(undefined)) return false;
	return [...workers].every((worker) =>
		journals.some(
			(row) =>
				row.value.workerIndex === worker &&
				row.value.events.some(
					(event) =>
						event.direction === "client-send" && event.kind === "goto-request",
				) &&
				row.value.events.some(
					(event) =>
						event.direction === "client-receive" &&
						event.kind === "goto-result",
				),
		),
	);
}
function capture(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		env: childEnvironment(process.env),
		timeout: 30000,
		maxBuffer: 65536,
	});
	if (result.status !== 0 || result.error)
		throw new Error("preflight-command-failed");
	return result.stdout.trim();
}
function verifyComposition(root) {
	for (const [name, revision] of Object.entries(PINS)) {
		const cwd = path.join(root, name);
		if (
			fs.realpathSync(cwd) !== cwd ||
			capture("git", ["rev-parse", "HEAD"], cwd) !== revision ||
			capture("git", ["status", "--porcelain", "--untracked-files=no"], cwd) !==
				""
		)
			throw new Error("composition-changed");
	}
}
async function main() {
	if (
		process.argv.length !== 4 ||
		process.platform !== "linux" ||
		process.arch !== "x64" ||
		process.version !== "v26.5.0"
	)
		throw new Error("unsupported-diagnostic-host");
	const root = path.resolve(process.argv[2]);
	const output = path.resolve(process.argv[3]);
	if (fs.realpathSync(root) !== root || fs.existsSync(output))
		throw new Error("invalid-diagnostic-path");
	verifyComposition(root);
	if (capture("bun", ["--revision"], root) !== "1.4.0-canary.1+57f349f63")
		throw new Error("unsupported-bun");
	const product = path.join(root, "application-development-toolkit");
	const workspace = path.join(product, "packages/starter/starter");
	const { bundle, core } = resolveCore(workspace);
	const chromiumExecutable =
		core.inprocess.playwright.chromium.executablePath();
	const chromiumExecutableSha256 =
		await verifyChromiumExecutable(chromiumExecutable);
	const diagnosticSha = capture(
		"git",
		["rev-parse", "HEAD"],
		path.join(__dirname, "../.."),
	);
	if (!/^[a-f0-9]{40}$/.test(diagnosticSha))
		throw new Error("invalid-diagnostic-revision");
	fs.mkdirSync(output, { mode: 0o700 });
	const raw = path.join(output, "raw");
	fs.mkdirSync(raw, { mode: 0o700 });
	const env = childEnvironment(process.env);
	Object.assign(env, {
		TOOLKIT_DIAG_ACTIVATE: "1",
		TOOLKIT_DIAG_OUTPUT: raw,
		TOOLKIT_DIAG_WORKSPACE: workspace,
		NODE_OPTIONS: `--require=${JSON.stringify(path.join(__dirname, "protocol.cjs"))}`,
	});
	const started = Date.now();
	const result = await runBounded(
		"bun",
		[
			"run",
			"--cwd",
			workspace,
			"test:e2e",
			"--workers",
			"2",
			"--retries",
			"0",
			"--reporter",
			path.join(__dirname, "reporter.cjs"),
		],
		{ cwd: product, env },
		900000,
		10000,
	);
	let inputsUnchanged = false;
	try {
		verifyComposition(root);
		inputsUnchanged =
			crypto
				.createHash("sha256")
				.update(fs.readFileSync(bundle))
				.digest("hex") === BUNDLE_SHA &&
			(await hashFile(chromiumExecutable)) === chromiumExecutableSha256;
	} catch {
		/* Report the failed invariant categorically. */
	}
	const destination = path.join(output, "sanitized");
	const accepted = exportEvidence(raw, destination);
	const journals = accepted.filter((row) => row.name !== "tests.json");
	const tests = accepted.find((row) => row.name === "tests.json")?.value;
	const complete = diagnosticComplete(inputsUnchanged, result, journals, tests);
	const hash = (file) =>
		crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
	const receipt = {
		schemaVersion: "opaque-playwright-run.v2",
		sourcePins: PINS,
		diagnosticSha,
		toolingSha: "8a27b8f5bf774fad04b8478fa9179eefdba0eaf7",
		bundleSha256: BUNDLE_SHA,
		chromiumExecutableSha256,
		recipeSha256: hash(__filename),
		observerSha256: hash(path.join(__dirname, "protocol.cjs")),
		reporterSha256: hash(path.join(__dirname, "reporter.cjs")),
		node: "v26.5.0",
		bun: "1.4.0-canary.1+57f349f63",
		playwright: "1.61.1",
		browserPins: {
			chromium: { revision: "1228", version: "149.0.7827.55" },
			firefox: { revision: "1532", version: "151.0" },
			webkit: { revision: "2311", version: "26.5" },
		},
		runnerImageVersion: /^\d{8}\.\d+\.\d+$/.test(process.env.ImageVersion || "")
			? process.env.ImageVersion
			: "unknown",
		elapsedMs: Date.now() - started,
		execution: result,
		inputsUnchanged,
		observationComplete: Boolean(complete),
		processCleanup: {
			launcherGroup: result.groupState,
			detachedDescendants: "unverified",
			runnerTeardown: "pending",
		},
		diagnosticComplete: false,
		productGateQualified: false,
	};
	fs.writeFileSync(
		path.join(destination, "receipt.json"),
		JSON.stringify(receipt),
		{ mode: 0o600 },
	);
	// Only this marker authorizes the workflow's artifact export, even on a failed experiment.
	fs.writeFileSync(path.join(output, "export-ready"), "1\n");
	process.stdout.write(
		`observation-complete=${Boolean(complete)} cleanup-unverified=true test-exit=${result.exitCode ?? "none"} deadline=${result.timedOut}\n`,
	);
	process.exitCode = result.timedOut
		? 124
		: result.exitCode === 0
			? 2
			: (result.exitCode ?? 1);
}
module.exports = {
	hashFile,
	verifyChromiumExecutable,
	runBounded,
	childEnvironment,
	exportEvidence,
	diagnosticComplete,
};
if (require.main === module)
	main().catch(() => {
		process.stderr.write("diagnostic-refused-or-incomplete\n");
		process.exitCode = 2;
	});
