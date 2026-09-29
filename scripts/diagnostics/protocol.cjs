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
	function snapshot() {
		return {
			schemaVersion: "opaque-playwright-order.v2",
			workerIndex:
				integer(workerIndex) && workerIndex < 26 ? workerIndex : null,
			incomplete,
			dropped,
			events: events.map((event) => ({ ...event })),
		};
	}
	function markIncomplete() {
		incomplete = true;
	}
	return { observe, snapshot, markIncomplete };
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
		value.schemaVersion !== "opaque-playwright-order.v2" ||
		(value.workerIndex !== null &&
			(!integer(value.workerIndex) || value.workerIndex >= 26)) ||
		typeof value.incomplete !== "boolean" ||
		!integer(value.dropped) ||
		!Array.isArray(value.events) ||
		value.events.length > LIMIT
	)
		return false;
	let previous = 0;
	for (const row of value.events) {
		const common = ["sequence", "elapsedMs", "direction", "kind", "object"];
		const fields = {
			create: ["type", "parent", "browser"],
			dispose: ["type", "reason"],
			close: ["type", "reason"],
			"goto-request": ["rpc"],
			"goto-result": ["rpc", "response", "hasError", "responsePresent"],
		}[row?.kind];
		if (
			!Array.isArray(fields) ||
			!keys(row, [...common, ...fields]) ||
			!integer(row.sequence) ||
			row.sequence <= previous ||
			!integer(row.elapsedMs) ||
			row.elapsedMs > 3600000 ||
			!DIRECTIONS.has(row.direction) ||
			!integer(row.object) ||
			row.object === 0 ||
			row.object > 8192
		)
			return false;
		previous = row.sequence;
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
	return true;
}
function attach(client, server, recorder) {
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
	attach(client, server, {
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
	});
	persist();
	process.on("exit", () => persist(true));
}
module.exports = {
	createRecorder,
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
