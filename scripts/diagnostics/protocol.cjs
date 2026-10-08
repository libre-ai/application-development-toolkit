// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const TYPES = new Set([
	"Browser",
	"BrowserContext",
	"Page",
	"Frame",
	"Request",
	"Response",
	"CDPSession",
]);
const DIRECTIONS = new Set(["server-send", "client-receive", "client-send"]);
const BUNDLE_SHA =
	"38511c1916e1950b9f70b4292d94863e8cc923244a5976bc042507f0cf124540";
const LIMIT = 4096;
const SIGNALS = new Set([
	"SIGTERM",
	"SIGKILL",
	"SIGINT",
	"SIGHUP",
	"SIGSEGV",
	"SIGABRT",
	"SIGILL",
	"SIGBUS",
	"SIGTRAP",
]);
const LIFECYCLE = new Set([
	"internal-close",
	"internal-kill",
	"browser-disconnected",
	"process-close-request",
	"process-kill-request",
	"transport-close",
	"process-exit",
	"process-close",
	"process-already-exited",
	"worker-signal-event",
	"worker-exit-event",
]);
const STDERR_BYTES = 262144;
const STDERR_LINES = 256;
const STDERR_LINE_BYTES = 4096;
const STDERR_CODES = new Map([
	["chromium-fatal", "fatal"],
	["chromium-check", "check"],
	["v8-check", "check"],
	["native-assertion", "assertion"],
	["v8-process-allocation", "oom"],
	["v8-heap-allocation", "oom"],
	["native-out-of-memory", "oom"],
	["sandbox-unusable", "sandbox"],
	["zygote-host-site", "zygote"],
	["zygote-site", "zygote"],
	["crashpad-client-site", "crashpad"],
]);
function classifyStderrLine(line) {
	const codes = [];
	// Header syntax comes from the pinned Chromium LogMessage::Init. Console
	// messages and unstructured application text are not native log evidence.
	const native =
		/^\[[0-9:./]+:(INFO|WARNING|ERROR|FATAL):([A-Za-z0-9_./-]+):[0-9]+\] (.*)$/.exec(
			line,
		);
	if (native && native[2] !== "CONSOLE") {
		const [, severity, source, body] = native;
		if (severity === "FATAL") codes.push("chromium-fatal");
		if (body.startsWith("Check failed: ")) codes.push("chromium-check");
		if (body.startsWith("No usable sandbox!")) codes.push("sandbox-unusable");
		if (body.startsWith("Out of memory.")) codes.push("native-out-of-memory");
		if (
			source.endsWith("/zygote_host_impl_linux.cc") ||
			source === "zygote_host_impl_linux.cc"
		)
			codes.push("zygote-host-site");
		if (source.endsWith("/zygote_linux.cc") || source === "zygote_linux.cc")
			codes.push("zygote-site");
		if (
			source.endsWith("/crashpad_client_linux.cc") ||
			source === "crashpad_client_linux.cc"
		)
			codes.push("crashpad-client-site");
	} else if (line.startsWith("# Check failed: ")) codes.push("v8-check");
	else if (line.startsWith("assertion failed: "))
		codes.push("native-assertion");
	else if (/^# Fatal [A-Za-z]{1,24} out of memory: /.test(line)) {
		if (line.includes("Allocation failed - process out of memory"))
			codes.push("v8-process-allocation");
		if (line.includes("Allocation failed - JavaScript heap out of memory"))
			codes.push("v8-heap-allocation");
	}
	return codes;
}
function createStderrObserver({ record, state, incomplete }) {
	let bytes = 0;
	let lines = 0;
	let unknownLines = 0;
	let pending = "";
	let overlong = false;
	let stopped = false;
	let ended = false;
	function mark() {
		try {
			incomplete();
		} catch {
			/* Preserve the existing stream consumer. */
		}
	}
	function emitState(name) {
		try {
			state(name, bytes, lines, unknownLines);
		} catch {
			mark();
		}
	}
	function finishLine() {
		if (lines === STDERR_LINES) {
			mark();
			stopped = true;
			pending = "";
			return;
		}
		lines++;
		if (!overlong) {
			const line = pending.endsWith("\r") ? pending.slice(0, -1) : pending;
			const codes = classifyStderrLine(line);
			if (codes.length === 0) unknownLines++;
			for (const code of codes) {
				try {
					record(STDERR_CODES.get(code), code);
				} catch {
					mark();
				}
			}
		}
		pending = "";
		overlong = false;
	}
	function write(chunk) {
		if (ended) {
			mark();
			return;
		}
		if (stopped) return;
		if (!Buffer.isBuffer(chunk) && typeof chunk !== "string") {
			mark();
			stopped = true;
			pending = "";
			return;
		}
		const remaining = STDERR_BYTES - bytes;
		// Bound conversion before allocating. Node emits Buffer chunks here; strings
		// are also supported without retaining their original representation.
		const length = Buffer.isBuffer(chunk)
			? chunk.length
			: Buffer.byteLength(chunk);
		const overflow = length > remaining;
		const bounded = Buffer.isBuffer(chunk)
			? chunk.subarray(0, remaining)
			: Buffer.from(chunk.slice(0, remaining)).subarray(0, remaining);
		const text = bounded.toString("latin1");
		bytes += bounded.length;
		let offset = 0;
		while (offset < text.length && !stopped) {
			const newline = text.indexOf("\n", offset);
			const end = newline === -1 ? text.length : newline;
			if (!overlong) {
				if (pending.length + end - offset > STDERR_LINE_BYTES) {
					mark();
					overlong = true;
					pending = "";
				} else pending += text.slice(offset, end);
			}
			if (newline !== -1) finishLine();
			offset = end + 1;
		}
		if (overflow) {
			mark();
			stopped = true;
			pending = "";
		}
	}
	function end() {
		if (ended) return;
		if (!stopped && (pending.length || overlong)) finishLine();
		ended = true;
		emitState("ended");
	}
	function close() {
		if (!ended) {
			mark();
			end();
		}
	}
	emitState("attached");
	return { write, end, close };
}
function exitCategory(value) {
	if (value === null || value === undefined) return "none";
	if (!Number.isSafeInteger(value)) return "other";
	return value === 0 ? "zero" : "nonzero";
}
function signalCategory(value) {
	if (value === null || value === undefined) return "none";
	return SIGNALS.has(value) ? value : "other";
}
function identity(value) {
	return typeof value === "string" && value.length > 0 && value.length <= 128;
}
function integer(value) {
	return Number.isSafeInteger(value) && value >= 0;
}
function keys(value, expected) {
	return (
		value &&
		typeof value === "object" &&
		Object.keys(value).sort().join(",") === [...expected].sort().join(",")
	);
}
function createRecorder({ clock, present, workerIndex = null }) {
	const aliases = new Map();
	const types = new Map();
	const calls = new Map();
	const events = [];
	const pendingStderr = new Set();
	let sequence = 0;
	let dropped = 0;
	let incomplete = false;
	function alias(value) {
		if (!identity(value)) return null;
		if (!aliases.has(value)) {
			if (aliases.size >= 8192) {
				incomplete = true;
				return null;
			}
			aliases.set(value, aliases.size + 1);
		}
		return aliases.get(value);
	}
	function append(event) {
		if (events.length === LIMIT) {
			events.shift();
			dropped++;
			incomplete = true;
		}
		const elapsed = clock();
		events.push({
			sequence: ++sequence,
			elapsedMs:
				Number.isFinite(elapsed) && elapsed >= 0
					? Math.min(Math.round(elapsed), 3600000)
					: 0,
			...event,
		});
	}
	function observe(direction, message, ownerType) {
		if (!DIRECTIONS.has(direction) || !message || typeof message !== "object")
			return;
		const params = message.params;
		if (
			message.method === "__create__" &&
			TYPES.has(params?.type) &&
			identity(params.guid)
		) {
			const object = alias(params.guid);
			const parent = alias(message.guid);
			if (object === null) return;
			types.set(params.guid, params.type);
			const browser =
				params.type === "Browser"
					? new Map([
							["149.0.7827.55", "chromium"],
							["151.0", "firefox"],
							["26.5", "webkit"],
						]).get(params.initializer?.version) || "unknown"
					: null;
			append({
				direction,
				kind: "create",
				type: params.type,
				object,
				parent,
				browser,
			});
		} else if (
			(message.method === "__dispose__" || message.method === "close") &&
			types.has(message.guid)
		) {
			append({
				direction,
				kind: message.method === "close" ? "close" : "dispose",
				type: types.get(message.guid),
				object: alias(message.guid),
				reason: params?.reason === "gc" ? "gc" : "other",
			});
		} else if (
			message.method === "goto" &&
			ownerType === "Frame" &&
			identity(message.guid) &&
			integer(message.id)
		) {
			if (calls.size >= 1024) {
				incomplete = true;
				return;
			}
			const object = alias(message.guid);
			if (object === null) return;
			// RPC IDs are numeric counters local to this connection, never application data.
			calls.set(message.id, object);
			append({ direction, kind: "goto-request", object, rpc: message.id });
		} else if (
			!message.method &&
			integer(message.id) &&
			calls.has(message.id)
		) {
			const guid = message.result?.response?.guid;
			const response = alias(guid);
			append({
				direction,
				kind: "goto-result",
				object: calls.get(message.id),
				rpc: message.id,
				response,
				hasError: Boolean(message.error),
				responsePresent: identity(guid) ? Boolean(present(guid)) : null,
			});
			if (direction === "client-receive") calls.delete(message.id);
		}
	}
	function lifecycle(guid, category, code = null, signal = null) {
		const worker =
			category === "worker-signal-event" || category === "worker-exit-event";
		if (
			!LIFECYCLE.has(category) ||
			(worker ? guid !== null : !identity(guid))
		) {
			incomplete = true;
			return;
		}
		const object = worker ? null : alias(guid);
		if (!worker && object === null) return;
		append({
			direction: worker ? "worker-lifecycle" : "server-lifecycle",
			kind: "lifecycle",
			object,
			category,
			exitCategory: exitCategory(code),
			signal: signalCategory(signal),
		});
	}
	function stderrCategory(guid, category, code) {
		if (
			!identity(guid) ||
			!STDERR_CODES.has(code) ||
			STDERR_CODES.get(code) !== category
		) {
			incomplete = true;
			return;
		}
		const object = alias(guid);
		if (object === null) return;
		append({
			direction: "server-stderr",
			kind: "stderr-category",
			object,
			category,
			code,
		});
	}
	function stderrState(guid, state, bytes, lines, unknownLines = 0) {
		if (
			!identity(guid) ||
			!["attached", "ended"].includes(state) ||
			!integer(bytes) ||
			bytes > STDERR_BYTES ||
			!integer(lines) ||
			lines > STDERR_LINES ||
			!integer(unknownLines) ||
			unknownLines > lines
		) {
			incomplete = true;
			return;
		}
		const object = alias(guid);
		if (object === null) return;
		if (state === "attached") {
			if (pendingStderr.has(object) || pendingStderr.size >= 64) {
				incomplete = true;
				return;
			}
			pendingStderr.add(object);
		} else if (!pendingStderr.delete(object)) incomplete = true;
		append({
			direction: "server-stderr",
			kind: "stderr-state",
			object,
			state,
			bytes,
			lines,
			unknownLines,
		});
	}
	function snapshot() {
		return {
			schemaVersion: "opaque-playwright-order.v4",
			workerIndex:
				integer(workerIndex) && workerIndex < 26 ? workerIndex : null,
			incomplete: incomplete || pendingStderr.size > 0,
			dropped,
			events: events.map((event) => ({ ...event })),
		};
	}
	function markIncomplete() {
		incomplete = true;
	}
	return {
		observe,
		lifecycle,
		stderrCategory,
		stderrState,
		snapshot,
		markIncomplete,
	};
}
function validateJournal(value) {
	if (
		!keys(value, [
			"schemaVersion",
			"workerIndex",
			"incomplete",
			"dropped",
			"events",
		]) ||
		value.schemaVersion !== "opaque-playwright-order.v4" ||
		(value.workerIndex !== null &&
			(!integer(value.workerIndex) || value.workerIndex >= 26)) ||
		typeof value.incomplete !== "boolean" ||
		!integer(value.dropped) ||
		!Array.isArray(value.events) ||
		value.events.length > LIMIT
	)
		return false;
	let previous = 0;
	const stderrPending = new Set();
	for (const row of value.events) {
		const common = ["sequence", "elapsedMs", "direction", "kind", "object"];
		const fields = {
			create: ["type", "parent", "browser"],
			dispose: ["type", "reason"],
			close: ["type", "reason"],
			"goto-request": ["rpc"],
			lifecycle: ["category", "exitCategory", "signal"],
			"stderr-category": ["category", "code"],
			"stderr-state": ["state", "bytes", "lines", "unknownLines"],
			"goto-result": ["rpc", "response", "hasError", "responsePresent"],
		}[row?.kind];
		if (
			!Array.isArray(fields) ||
			!keys(row, [...common, ...fields]) ||
			!integer(row.sequence) ||
			row.sequence <= previous ||
			!integer(row.elapsedMs) ||
			row.elapsedMs > 3600000 ||
			(!["lifecycle", "stderr-category", "stderr-state"].includes(row.kind) &&
				!DIRECTIONS.has(row.direction)) ||
			((row.kind !== "lifecycle" || row.object !== null) &&
				(!integer(row.object) || row.object === 0 || row.object > 8192))
		)
			return false;
		previous = row.sequence;
		if (
			["stderr-category", "stderr-state"].includes(row.kind) &&
			row.direction !== "server-stderr"
		)
			return false;
		if (
			row.kind === "stderr-category" &&
			(!STDERR_CODES.has(row.code) ||
				STDERR_CODES.get(row.code) !== row.category)
		)
			return false;
		if (
			row.kind === "stderr-state" &&
			(!["attached", "ended"].includes(row.state) ||
				!integer(row.bytes) ||
				row.bytes > STDERR_BYTES ||
				!integer(row.lines) ||
				row.lines > STDERR_LINES ||
				!integer(row.unknownLines) ||
				row.unknownLines > row.lines)
		)
			return false;
		if (row.kind === "stderr-state") {
			if (row.state === "attached") {
				if (row.bytes !== 0 || row.lines !== 0 || stderrPending.has(row.object))
					return false;
				stderrPending.add(row.object);
			} else if (!stderrPending.delete(row.object) && !value.incomplete)
				return false;
		}
		if (
			row.kind === "stderr-category" &&
			!stderrPending.has(row.object) &&
			!value.incomplete
		)
			return false;
		if (row.kind === "lifecycle") {
			const worker =
				row.category === "worker-signal-event" ||
				row.category === "worker-exit-event";
			if (
				!LIFECYCLE.has(row.category) ||
				!["zero", "nonzero", "none", "other"].includes(row.exitCategory) ||
				!(SIGNALS.has(row.signal) || ["none", "other"].includes(row.signal)) ||
				row.direction !== (worker ? "worker-lifecycle" : "server-lifecycle") ||
				(worker ? row.object !== null : row.object === null)
			)
				return false;
		}
		if ("type" in row && !TYPES.has(row.type)) return false;
		if (
			"browser" in row &&
			![null, "chromium", "firefox", "webkit", "unknown"].includes(row.browser)
		)
			return false;
		if (
			"parent" in row &&
			row.parent !== null &&
			(!integer(row.parent) || row.parent > 8192)
		)
			return false;
		if ("reason" in row && !["gc", "other"].includes(row.reason)) return false;
		if ("rpc" in row && !integer(row.rpc)) return false;
		if (
			row.kind === "goto-result" &&
			((row.response !== null &&
				(!integer(row.response) || row.response > 8192)) ||
				typeof row.hasError !== "boolean" ||
				![true, false, null].includes(row.responsePresent))
		)
			return false;
	}
	return stderrPending.size === 0 || value.incomplete;
}
function createLifecycleObserver(server, recorder, worker) {
	const observed = new WeakSet();
	let count = 0;
	function incomplete() {
		try {
			recorder.markIncomplete();
		} catch {
			/* Keep original runtime behavior. */
		}
	}
	function record(guid, category, code = null, signal = null) {
		try {
			recorder.lifecycle(guid, category, code, signal);
		} catch {
			incomplete();
		}
	}
	function wrap(owner, method, before) {
		try {
			const original = owner?.[method];
			if (typeof original !== "function") {
				incomplete();
				return;
			}
			const wrapped = function (...args) {
				try {
					before(args);
				} catch {
					incomplete();
				}
				return Reflect.apply(original, this, args);
			};
			owner[method] = wrapped;
			if (owner[method] !== wrapped) incomplete();
		} catch {
			incomplete();
		}
	}
	// Wrapping emit preserves signal listener counts and Node's default handling.
	wrap(worker, "emit", (args) => {
		if (SIGNALS.has(args[0]))
			record(null, "worker-signal-event", null, args[0]);
		if (args[0] === "exit") record(null, "worker-exit-event", args[1]);
	});
	function observe(message) {
		if (message?.method !== "__create__" || message.params?.type !== "Browser")
			return;
		try {
			const guid = message.params.guid;
			if (!identity(guid)) {
				incomplete();
				return;
			}
			const browser = server._dispatcherByGuid?.get(guid)?._object;
			if (!browser || typeof browser !== "object") {
				incomplete();
				return;
			}
			if (observed.has(browser)) return;
			if (count >= 64) {
				incomplete();
				return;
			}
			observed.add(browser);
			count++;
			for (const [method, category] of [
				["_close", "internal-close"],
				["didClose", "browser-disconnected"],
				["killForTests", "internal-kill"],
			])
				wrap(browser, method, () => record(guid, category));
			const browserProcess = browser.options?.browserProcess;
			wrap(browserProcess, "close", () =>
				record(guid, "process-close-request"),
			);
			wrap(browserProcess, "kill", () => record(guid, "process-kill-request"));
			const transport = browser._connection?._transport;
			// The verified PipeTransport setter may invoke onclose immediately. Wrap
			// its existing own callback instead, without changing setter behavior.
			const callback =
				transport && Object.getOwnPropertyDescriptor(transport, "_onclose");
			if (!callback || typeof callback.value !== "function") incomplete();
			else wrap(transport, "_onclose", () => record(guid, "transport-close"));
			const child = browserProcess?.process;
			if (message.params.initializer?.version === "149.0.7827.55") {
				const stderr = createStderrObserver({
					record: (category, code) =>
						recorder.stderrCategory(guid, category, code),
					state: (state, bytes, lines, unknownLines) =>
						recorder.stderrState(guid, state, bytes, lines, unknownLines),
					incomplete,
				});
				wrap(child?.stderr, "emit", (args) => {
					if (args[0] === "data") stderr.write(args[1]);
					if (args[0] === "end") stderr.end();
					if (args[0] === "close") stderr.close();
				});
			}
			wrap(child, "emit", (args) => {
				if (args[0] === "exit") record(guid, "process-exit", args[1], args[2]);
				if (args[0] === "close")
					record(guid, "process-close", args[1], args[2]);
			});
			if (child && (child.exitCode != null || child.signalCode != null)) {
				incomplete();
				record(
					guid,
					"process-already-exited",
					child.exitCode,
					child.signalCode,
				);
			}
		} catch {
			incomplete();
		}
	}
	return { observe };
}
function attach(client, server, recorder, lifecycle = null) {
	for (const [owner, method, direction] of [
		[server, "onmessage", "server-send"],
		[client, "dispatch", "client-receive"],
		[client, "onmessage", "client-send"],
	]) {
		const original = owner[method];
		owner[method] = function (...args) {
			try {
				recorder.observe(
					direction,
					args[0],
					client._objects.get(args[0]?.guid)?._type,
				);
				if (direction === "server-send") lifecycle?.observe(args[0]);
			} catch {
				/* Observability must not replace transport behavior. */
				try {
					recorder.markIncomplete();
				} catch {
					/* Preserve the transport even if its diagnostic sink failed. */
				}
			}
			return Reflect.apply(original, this, args);
		};
	}
}
function resolveCore(workspace) {
	const testEntry = createRequire(path.join(workspace, "package.json")).resolve(
		"@playwright/test",
	);
	const playwrightEntry = createRequire(testEntry).resolve("playwright");
	const coreEntry = createRequire(playwrightEntry).resolve("playwright-core");
	const bundle = path.join(path.dirname(coreEntry), "lib/coreBundle.js");
	const bundleSha = crypto
		.createHash("sha256")
		.update(fs.readFileSync(bundle))
		.digest("hex");
	if (process.version !== "v26.5.0" || bundleSha !== BUNDLE_SHA)
		throw new Error("unsupported-diagnostic-runtime");
	return { bundle, core: require(bundle), bundleSha };
}
function install() {
	const output = process.env.TOOLKIT_DIAG_OUTPUT;
	const workspace = process.env.TOOLKIT_DIAG_WORKSPACE;
	if (
		!output ||
		!workspace ||
		fs.realpathSync(output) !== output ||
		fs.realpathSync(workspace) !== workspace
	)
		throw new Error("invalid-diagnostic-directory");
	let fd;
	for (let slot = 0; slot < 64; slot++) {
		try {
			fd = fs.openSync(path.join(output, `events-${slot}.json`), "wx", 0o600);
			break;
		} catch (error) {
			if (error.code !== "EEXIST") throw error;
		}
	}
	if (fd === undefined) throw new Error("diagnostic-slot-limit");
	const { core } = resolveCore(workspace);
	const client = core.inprocess.playwright._connection;
	const server = client.toImpl(client);
	const start = performance.now();
	const recorder = createRecorder({
		clock: () => performance.now() - start,
		present: (guid) => client._objects.has(guid),
	});
	let failed = false;
	function persist(final = false) {
		try {
			const value = recorder.snapshot();
			// Playwright assigns this after Node has evaluated its preloads.
			const worker = /^\d{1,2}$/.test(process.env.TEST_WORKER_INDEX || "")
				? Number(process.env.TEST_WORKER_INDEX)
				: null;
			value.workerIndex = worker !== null && worker < 26 ? worker : null;
			value.incomplete ||= failed || !final;
			const bytes = JSON.stringify(value);
			if (Buffer.byteLength(bytes) > 1048576)
				throw new Error("diagnostic-byte-limit");
			fs.writeSync(fd, bytes, 0, "utf8");
			fs.ftruncateSync(fd, Buffer.byteLength(bytes));
		} catch {
			failed = true;
		}
	}
	const lifecycle = createLifecycleObserver(server, recorder, process);
	attach(
		client,
		server,
		{
			markIncomplete: recorder.markIncomplete,
			observe(...args) {
				recorder.observe(...args);
				const [direction, message] = args;
				if (
					direction === "client-receive" &&
					message?.result?.response?.guid &&
					!client._objects.has(message.result.response.guid)
				)
					persist();
			},
		},
		lifecycle,
	);
	persist();
	process.on("exit", () => persist(true));
}
module.exports = {
	createRecorder,
	createLifecycleObserver,
	createStderrObserver,
	validateJournal,
	attach,
	resolveCore,
	BUNDLE_SHA,
};
if (process.env.TOOLKIT_DIAG_ACTIVATE === "1" && !process.versions.bun) {
	try {
		install();
	} catch {
		process.stderr.write("diagnostic-preload-refused\n");
		process.exitCode = 2;
	}
}
