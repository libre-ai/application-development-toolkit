// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { test } = require("node:test");
const protocolPath = path.join(__dirname, "protocol.cjs");
function api() {
	assert.ok(fs.existsSync(protocolPath), "opaque observer must exist");
	return require(protocolPath);
}
const privateMarker = "PRIVATE_SENTINEL_DO_NOT_EXPORT";
function fixture(recorder) {
	recorder.observe("server-send", {
		method: "__create__",
		guid: "root",
		params: { type: "Page", guid: "page", initializer: { url: privateMarker } },
	});
	recorder.observe("client-receive", {
		method: "__create__",
		guid: "root",
		params: { type: "Page", guid: "page" },
	});
	recorder.observe("client-receive", {
		method: "__create__",
		guid: "page",
		params: { type: "Frame", guid: "frame" },
	});
	recorder.observe("client-receive", {
		method: "__create__",
		guid: "page",
		params: { type: "Request", guid: "request" },
	});
	recorder.observe("client-receive", {
		method: "__create__",
		guid: "request",
		params: { type: "Response", guid: "response" },
	});
	recorder.observe(
		"client-send",
		{
			method: "goto",
			guid: "frame",
			id: 71,
			params: {
				url: privateMarker,
				headers: { cookie: privateMarker },
				body: privateMarker,
			},
		},
		"Frame",
	);
	recorder.observe("client-receive", {
		method: "__dispose__",
		guid: "request",
		params: { reason: privateMarker },
	});
	recorder.observe("server-send", {
		id: 71,
		result: {
			response: { guid: "response", privateMarker },
			url: privateMarker,
		},
	});
	recorder.observe("client-receive", {
		id: 71,
		result: { response: { guid: "response" } },
		error: { message: privateMarker },
	});
}
test("projects nested private protocol values out while retaining parent and RPC ordering", () => {
	const { createRecorder, validateJournal } = api();
	const recorder = createRecorder({ clock: () => 12, present: () => false });
	fixture(recorder);
	const value = recorder.snapshot();
	assert.equal(JSON.stringify(value).includes(privateMarker), false);
	assert.equal(validateJournal(value), true);
	const request = value.events.find(
		(row) => row.kind === "create" && row.type === "Request",
	);
	const response = value.events.find(
		(row) => row.kind === "create" && row.type === "Response",
	);
	const goto = value.events.find((row) => row.kind === "goto-request");
	const result = value.events.at(-1);
	assert.equal(response.parent, request.object);
	assert.equal(result.rpc, goto.rpc);
	assert.equal(result.response, response.object);
	assert.equal(result.responsePresent, false);
	assert.equal(value.events.at(-3).object, request.object);
	assert.ok(value.events.at(-3).sequence < result.sequence);
});
test("drops unknown directions, malformed identities and unknown owner types", () => {
	const recorder = api().createRecorder({
		clock: () => NaN,
		present: () => true,
	});
	for (const message of [
		null,
		{},
		{ method: privateMarker },
		{ method: "__create__", params: { type: privateMarker, guid: "x" } },
		{ method: "goto", guid: privateMarker.repeat(100), id: 1 },
	]) {
		recorder.observe("client-send", message, "Frame");
		recorder.observe(privateMarker, message, "Frame");
	}
	assert.deepEqual(recorder.snapshot().events, []);
});
test("bounds retained events and identities and marks saturation explicitly", () => {
	const recorder = api().createRecorder({
		clock: () => 1,
		present: () => true,
	});
	for (let index = 0; index < 20000; index++)
		recorder.observe("client-receive", {
			method: "__create__",
			guid: "root",
			params: { type: "Page", guid: `page-${index}` },
		});
	const value = recorder.snapshot();
	assert.ok(value.events.length <= 4096);
	assert.equal(value.incomplete, true);
	assert.ok(value.dropped > 0);
	assert.ok(Buffer.byteLength(JSON.stringify(value)) < 1048576);
	assert.equal(api().validateJournal(value), true);
});
test("snapshot mutation cannot inject fields into a later persisted journal", () => {
	const recorder = api().createRecorder({
		clock: () => 1,
		present: () => true,
	});
	fixture(recorder);
	recorder.snapshot().events[0].private = privateMarker;
	assert.equal(
		JSON.stringify(recorder.snapshot()).includes(privateMarker),
		false,
	);
});
test("strict journal validation rejects unknown fields, nonfinite values and private enums", () => {
	const { createRecorder, validateJournal } = api();
	const recorder = createRecorder({ clock: () => 1, present: () => true });
	fixture(recorder);
	for (const mutate of [
		(value) => {
			value.private = privateMarker;
		},
		(value) => {
			value.events[0].type = privateMarker;
		},
		(value) => {
			value.events[0].elapsedMs = Infinity;
		},
		(value) => {
			value.events[0].url = privateMarker;
		},
		(value) => {
			value.events[0].object = privateMarker;
		},
	]) {
		const value = recorder.snapshot();
		mutate(value);
		assert.equal(validateJournal(value), false);
	}
});
test("observer errors never change transport receiver, arguments, return value or thrown identity", () => {
	const { attach } = api();
	const failure = new Error("original failure");
	let calls = 0;
	const client = {
		_objects: new Map(),
		dispatch(message) {
			assert.equal(this, client);
			assert.equal(message, original);
			calls++;
			return 17;
		},
		onmessage() {
			throw failure;
		},
	};
	const server = {
		onmessage(message) {
			assert.equal(this, server);
			assert.equal(message, original);
			calls++;
			return 23;
		},
	};
	const original = { params: { privateMarker } };
	attach(client, server, {
		observe() {
			throw new Error(privateMarker);
		},
	});
	assert.equal(client.dispatch(original), 17);
	assert.equal(server.onmessage(original), 23);
	assert.throws(
		() => client.onmessage(original),
		(error) => error === failure,
	);
	assert.equal(calls, 2);
});
test("disabled preload has no filesystem effects and does not resolve Playwright", () => {
	const { spawnSync } = require("node:child_process");
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-disabled-"));
	try {
		const result = spawnSync(
			process.execPath,
			["--require", protocolPath, "-e", ""],
			{ cwd, env: { PATH: process.env.PATH }, encoding: "utf8" },
		);
		assert.equal(result.status, 0);
		assert.equal(result.stderr, "");
		assert.deepEqual(fs.readdirSync(cwd), []);
	} finally {
		fs.rmdirSync(cwd);
	}
});
test("records browser identity only when the runtime version matches a fixed known pin", () => {
	const recorder = api().createRecorder({
		clock: () => 1,
		present: () => true,
	});
	for (const [index, version] of [
		"149.0.7827.55",
		"151.0",
		"26.5",
		privateMarker,
	].entries())
		recorder.observe("client-receive", {
			method: "__create__",
			guid: "root",
			params: {
				type: "Browser",
				guid: `browser-${index}`,
				initializer: { version },
			},
		});
	assert.deepEqual(
		recorder.snapshot().events.map((row) => row.browser),
		["chromium", "firefox", "webkit", "unknown"],
	);
	assert.equal(
		JSON.stringify(recorder.snapshot()).includes(privateMarker),
		false,
	);
});
function reporterApi() {
	const file = path.join(__dirname, "reporter.cjs");
	assert.ok(fs.existsSync(file), "opaque reporter must exist");
	return require(file);
}
test("reporter omits test titles, errors, attachments and raw output but preserves each outcome", () => {
	const Reporter = reporterApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-reporter-"));
	try {
		const reporter = new Reporter({ output: root });
		const one = {
			title: privateMarker,
			location: { file: privateMarker },
			parent: { project: () => ({ name: "chromium" }) },
		};
		const two = {
			title: privateMarker,
			parent: { project: () => ({ name: privateMarker }) },
		};
		reporter.onBegin({}, { allTests: () => [one, two] });
		reporter.onTestEnd(one, {
			status: "failed",
			duration: 13.5,
			retry: 0,
			errors: [
				{
					message: `Object with guid ${privateMarker} was not bound in the connection`,
				},
			],
			attachments: [{ path: privateMarker }],
		});
		reporter.onTestEnd(two, {
			status: "timedOut",
			duration: 30,
			retry: 0,
			errors: [{ message: privateMarker }],
		});
		reporter.onEnd({ status: "failed" });
		const value = JSON.parse(fs.readFileSync(path.join(root, "tests.json")));
		assert.equal(JSON.stringify(value).includes(privateMarker), false);
		assert.deepEqual(value.tests, [
			{
				ordinal: 1,
				workerIndex: null,
				project: "chromium",
				status: "failed",
				durationMs: 14,
				retry: 0,
				errorCategory: "unknown-guid",
			},
			{
				ordinal: 2,
				workerIndex: null,
				project: "unknown",
				status: "timedOut",
				durationMs: 30,
				retry: 0,
				errorCategory: "other",
			},
		]);
		assert.equal(Reporter.validateReport(value), true);
		assert.equal(
			Reporter.validateReport({ ...value, secret: privateMarker }),
			false,
		);
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
function runnerApi() {
	const file = path.join(__dirname, "run.cjs");
	assert.ok(fs.existsSync(file), "bounded supervisor must exist");
	return require(file);
}
test("subprocess supervisor preserves nonzero exit without forwarding stdout or private environment", async () => {
	const { runBounded, childEnvironment } = runnerApi();
	const env = childEnvironment({
		PATH: process.env.PATH,
		HOME: "/synthetic-home",
		GITHUB_TOKEN: privateMarker,
		NODE_OPTIONS: privateMarker,
		EXTRA: privateMarker,
	});
	assert.equal(JSON.stringify(env).includes(privateMarker), false);
	const result = await runBounded(
		process.execPath,
		[
			"-e",
			`process.stdout.write('${privateMarker}'); process.stderr.write('${privateMarker}'); process.exit(17);`,
		],
		{ cwd: __dirname, env },
		2000,
		100,
	);
	assert.deepEqual(result, {
		exitCode: 17,
		signal: null,
		timedOut: false,
		launchFailed: false,
		groupCleanupAttempted: false,
		groupState: "absent",
	});
});
test("supervisor terminates a process ignoring TERM within the bounded grace", async () => {
	const { runBounded } = runnerApi();
	const started = Date.now();
	const result = await runBounded(
		process.execPath,
		["-e", 'process.on("SIGTERM",()=>{}); setInterval(()=>{},1000);'],
		{ cwd: __dirname, env: {} },
		200,
		100,
	);
	assert.equal(result.timedOut, true);
	assert.equal(result.signal, "SIGKILL");
	assert.ok(Date.now() - started < 2000);
});
test("artifact export refuses symlinks and private fields instead of copying unchecked files", () => {
	const { exportEvidence } = runnerApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-export-"));
	try {
		const raw = path.join(root, "raw");
		fs.mkdirSync(raw);
		fs.writeFileSync(
			path.join(raw, "events-0.json"),
			JSON.stringify({
				...api()
					.createRecorder({ clock: () => 0, present: () => true })
					.snapshot(),
				secret: privateMarker,
			}),
		);
		assert.throws(() => exportEvidence(raw, path.join(root, "safe")));
		fs.unlinkSync(path.join(raw, "events-0.json"));
		fs.symlinkSync(__filename, path.join(raw, "events-0.json"));
		assert.throws(() => exportEvidence(raw, path.join(root, "safe")));
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
test("worker identities correlate a test outcome with its opaque connection journal", () => {
	const recorder = api().createRecorder({
		clock: () => 1,
		present: () => true,
		workerIndex: 3,
	});
	assert.equal(recorder.snapshot().workerIndex, 3);
	assert.equal(
		api().validateJournal({
			...recorder.snapshot(),
			workerIndex: privateMarker,
		}),
		false,
	);
});
test("journal validator rejects prototype property names and incomplete event shapes", () => {
	const base = api()
		.createRecorder({ clock: () => 1, present: () => true })
		.snapshot();
	for (const row of [
		null,
		{ kind: "toString" },
		{ kind: "__proto__" },
		{ kind: "create" },
	])
		assert.equal(api().validateJournal({ ...base, events: [row] }), false);
});
test("supervisor enforces the grace even if its launcher exits on TERM", async () => {
	const started = Date.now();
	const result = await runnerApi().runBounded(
		process.execPath,
		["-e", "setInterval(()=>{},1000);"],
		{ cwd: __dirname, env: {} },
		200,
		100,
	);
	assert.equal(result.timedOut, true);
	assert.equal(result.signal, "SIGTERM");
	assert.ok(Date.now() - started >= 290);
});
test("exports only validated canonical evidence and refuses pre-existing destinations", () => {
	const { exportEvidence } = runnerApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-valid-"));
	try {
		const raw = path.join(root, "raw");
		fs.mkdirSync(raw);
		const value = api()
			.createRecorder({ clock: () => 1, present: () => true })
			.snapshot();
		fs.writeFileSync(path.join(raw, "events-0.json"), JSON.stringify(value));
		const destination = path.join(root, "safe");
		const rows = exportEvidence(raw, destination);
		assert.equal(rows.length, 1);
		assert.deepEqual(
			JSON.parse(fs.readFileSync(path.join(destination, "events-0.json"))),
			value,
		);
		assert.throws(() => exportEvidence(raw, destination));
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
test("installed Playwright async transport preserves SDK rejection and observes recursive disposal", async () => {
	const workspace = process.env.TOOLKIT_DIAG_TEST_WORKSPACE;
	assert.ok(
		workspace,
		"set TOOLKIT_DIAG_TEST_WORKSPACE to the installed starter package",
	);
	const { resolveCore, attach, createRecorder, BUNDLE_SHA } = api();
	const { core, bundleSha, bundle } = resolveCore(workspace);
	assert.equal(bundleSha, BUNDLE_SHA);
	const pw = core.inprocess.createInProcessPlaywright();
	const client = pw._connection;
	const server = client.toImpl(client);
	const impl = client.toImpl(pw);
	const scope = server.existingDispatcher(impl);
	const recorder = createRecorder({
		clock: () => 1,
		present: (guid) => client._objects.has(guid),
	});
	attach(client, server, recorder);
	const tick = () => new Promise((resolve) => setImmediate(resolve));
	let entered, resume;
	const enteredPromise = new Promise((resolve) => {
		entered = resolve;
	});
	const resumePromise = new Promise((resolve) => {
		resume = resolve;
	});
	const request = new core.server.Request(
		impl,
		null,
		null,
		null,
		undefined,
		"https://fixture.invalid/",
		"document",
		"GET",
		null,
		[],
		0,
	);
	const requestDispatcher = core.server.RequestDispatcher.from(scope, request);
	const timing = Object.fromEntries(
		[
			"startTime",
			"domainLookupStart",
			"domainLookupEnd",
			"connectStart",
			"secureConnectionStart",
			"secureConnectionEnd",
			"connectEnd",
			"requestStart",
			"responseStart",
		].map((key) => [key, 0]),
	);
	const response = new core.server.Response(
		request,
		200,
		"OK",
		[],
		timing,
		async () => Buffer.alloc(0),
		false,
	);
	const responseDispatcher = core.server.ResponseDispatcher.from(
		scope,
		response,
	);
	request.instrumentation = {
		onBeforeCall: async () => {},
		onAfterCall: async () => {
			entered();
			await resumePromise;
		},
		onCallLog: () => {},
	};
	await tick();
	const actual = client
		.getObjectWithKnownName(requestDispatcher._guid)
		.response();
	const rejection = assert.rejects(actual, /was not bound in the connection/);
	await enteredPromise;
	requestDispatcher._dispose();
	await tick();
	assert.equal(client._objects.has(responseDispatcher._guid), false);
	resume();
	await rejection;
	const events = recorder.snapshot().events;
	const createdResponse = events.find(
		(row) =>
			row.direction === "client-receive" &&
			row.kind === "create" &&
			row.type === "Response",
	);
	const disposedRequest = events.find(
		(row) =>
			row.direction === "client-receive" &&
			row.kind === "dispose" &&
			row.type === "Request",
	);
	assert.equal(createdResponse.parent, disposedRequest.object);
	assert.ok(createdResponse.sequence < disposedRequest.sequence);
	assert.equal(client._callbacks.size, 0);
	assert.equal(
		require("node:crypto")
			.createHash("sha256")
			.update(fs.readFileSync(bundle))
			.digest("hex"),
		BUNDLE_SHA,
	);
});
test("activated preload records real installed transport into a bounded opaque slot", () => {
	const { spawnSync } = require("node:child_process");
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-preload-"));
	try {
		const workspace = fs.realpathSync(process.env.TOOLKIT_DIAG_TEST_WORKSPACE);
		const program = `
			process.env.TEST_WORKER_INDEX = '3';
      const { core } = require(${JSON.stringify(protocolPath)}).resolveCore(process.env.TOOLKIT_DIAG_WORKSPACE);
      const client = core.inprocess.playwright._connection;
      const impl = client.toImpl(core.inprocess.playwright);
      const scope = client.toImpl(client).existingDispatcher(impl);
      const request = new core.server.Request(impl, null, null, null, undefined, 'https://${privateMarker}.invalid/', 'document', 'GET', null, [], 0);
      const dispatcher = core.server.RequestDispatcher.from(scope, request);
      setImmediate(() => dispatcher._dispose());
    `;
		const result = spawnSync(
			process.execPath,
			["--require", protocolPath, "-e", program],
			{
				env: {
					...runnerApi().childEnvironment(process.env),
					TOOLKIT_DIAG_ACTIVATE: "1",
					TOOLKIT_DIAG_OUTPUT: fs.realpathSync(root),
					TOOLKIT_DIAG_WORKSPACE: workspace,
				},
				encoding: "utf8",
				timeout: 5000,
			},
		);
		assert.equal(result.status, 0);
		assert.equal(result.stderr, "");
		assert.deepEqual(fs.readdirSync(root), ["events-0.json"]);
		const value = JSON.parse(fs.readFileSync(path.join(root, "events-0.json")));
		assert.equal(api().validateJournal(value), true);
		assert.equal(value.workerIndex, 3);
		assert.equal(
			value.events.filter(
				(row) => row.direction === "client-receive" && row.type === "Request",
			).length,
			2,
		);
		assert.equal(JSON.stringify(value).includes(privateMarker), false);
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
test("unsupported activated preload fails explicitly without private exception text", () => {
	const { spawnSync } = require("node:child_process");
	const result = spawnSync(
		process.execPath,
		["--require", protocolPath, "-e", ""],
		{
			env: {
				TOOLKIT_DIAG_ACTIVATE: "1",
				TOOLKIT_DIAG_OUTPUT: privateMarker,
				TOOLKIT_DIAG_WORKSPACE: privateMarker,
			},
			encoding: "utf8",
			timeout: 5000,
		},
	);
	assert.equal(result.status, 2);
	assert.equal(result.stderr, "diagnostic-preload-refused\n");
});
test("reporter preserves worker identity without accepting arbitrary worker values", () => {
	const Reporter = reporterApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-worker-"));
	try {
		const reporter = new Reporter({ output: root });
		const testCase = { parent: { project: () => ({ name: "chromium" }) } };
		reporter.onBegin({}, { allTests: () => [testCase] });
		reporter.onTestEnd(testCase, {
			status: "passed",
			duration: 1,
			retry: 0,
			errors: [],
			workerIndex: 3,
		});
		const value = JSON.parse(fs.readFileSync(path.join(root, "tests.json")));
		assert.equal(value.tests[0].workerIndex, 3);
		value.tests[0].workerIndex = privateMarker;
		assert.equal(Reporter.validateReport(value), false);
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
test("a killed preloaded worker leaves an explicitly incomplete journal", async () => {
	const { spawn } = require("node:child_process");
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-killed-"));
	try {
		const child = spawn(
			process.execPath,
			[
				"--require",
				protocolPath,
				"-e",
				'process.send("ready"); setInterval(()=>{},1000);',
			],
			{
				env: {
					...runnerApi().childEnvironment(process.env),
					TOOLKIT_DIAG_ACTIVATE: "1",
					TOOLKIT_DIAG_OUTPUT: fs.realpathSync(root),
					TOOLKIT_DIAG_WORKSPACE: fs.realpathSync(
						process.env.TOOLKIT_DIAG_TEST_WORKSPACE,
					),
				},
				stdio: ["ignore", "ignore", "ignore", "ipc"],
			},
		);
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new Error("preload readiness deadline"));
			}, 5000);
			child.once("message", () => child.kill("SIGKILL"));
			child.once("close", () => {
				clearTimeout(timer);
				resolve();
			});
			child.once("error", reject);
		});
		const value = JSON.parse(fs.readFileSync(path.join(root, "events-0.json")));
		assert.equal(value.incomplete, true);
	} finally {
		fs.rmSync(root, { recursive: true });
	}
});
test("complete evidence requires observed goto transport for every reported worker", () => {
	const { diagnosticComplete } = runnerApi();
	assert.equal(typeof diagnosticComplete, "function");
	const tests = {
		expected: 26,
		tests: Array.from({ length: 26 }, (_, index) => ({
			ordinal: index + 1,
			workerIndex: 0,
		})),
		incomplete: false,
		finalStatus: "passed",
	};
	const result = {
		exitCode: 0,
		signal: null,
		timedOut: false,
		launchFailed: false,
	};
	const empty = { value: { workerIndex: 0, incomplete: false, events: [] } };
	assert.equal(diagnosticComplete(true, result, [empty], tests), false);
	const observed = {
		value: {
			workerIndex: 0,
			incomplete: false,
			events: [
				{ kind: "goto-request", direction: "client-send" },
				{ kind: "goto-result", direction: "client-receive" },
			],
		},
	};
	assert.equal(diagnosticComplete(true, result, [observed], tests), true);
	assert.equal(
		diagnosticComplete(true, result, [observed], {
			...tests,
			finalStatus: null,
		}),
		false,
	);
	assert.equal(diagnosticComplete(false, result, [observed], tests), false);
	assert.equal(
		diagnosticComplete(true, { ...result, timedOut: true }, [observed], tests),
		false,
	);
});

test("an observation exception marks its journal incomplete without changing transport", () => {
	const { attach, createRecorder } = api();
	const recorder = createRecorder({
		clock: () => {
			throw new Error(privateMarker);
		},
		present: () => true,
	});
	const client = {
		_objects: new Map(),
		dispatch: () => 17,
		onmessage: () => 23,
	};
	const server = { onmessage: () => 31 };
	attach(client, server, recorder);
	const result = client.dispatch({
		method: "__create__",
		guid: "root",
		params: { type: "Page", guid: "page" },
	});
	assert.equal(result, 17);
	assert.equal(recorder.snapshot().incomplete, true);
	assert.equal(
		JSON.stringify(recorder.snapshot()).includes(privateMarker),
		false,
	);
});

test("natural launcher exit still triggers bounded cleanup of its remaining process group", async () => {
	const { runBounded } = runnerApi();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "opaque-orphan-"));
	let descendant;
	try {
		const pidFile = path.join(root, "pid");
		const program = `const {spawn}=require('node:child_process'); const fs=require('node:fs'); const child=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000);'],{stdio:'ignore'}); fs.writeFileSync(${JSON.stringify(pidFile)},String(child.pid)); setTimeout(()=>process.exit(17),100);`;
		const result = await runBounded(
			process.execPath,
			["-e", program],
			{ cwd: __dirname, env: {} },
			2000,
			100,
		);
		descendant = Number(fs.readFileSync(pidFile));
		assert.equal(result.exitCode, 17);
		assert.equal(result.groupCleanupAttempted, true);
		assert.equal(result.timedOut, false);
		let running = false;
		try {
			process.kill(descendant, 0);
			running =
				process.platform !== "linux" ||
				fs
					.readFileSync(`/proc/${descendant}/stat`, "utf8")
					.split(") ")[1][0] !== "Z";
		} catch (error) {
			if (!["ESRCH", "ENOENT"].includes(error.code)) throw error;
		}
		assert.equal(running, false);
	} finally {
		if (descendant) {
			try {
				process.kill(descendant, "SIGKILL");
			} catch {
				/* Already terminated by the supervisor. */
			}
		}
		fs.rmSync(root, { recursive: true });
	}
});
