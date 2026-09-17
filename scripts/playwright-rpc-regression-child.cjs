// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const workspace = process.argv[2];
const mode = process.argv[3];
assert.equal(process.version, "v26.5.0");
assert.ok(["control", "dispose", "malformed", "rpc-error"].includes(mode));
const fromWorkspace = createRequire(path.join(workspace, "package.json"));
const testEntry = fromWorkspace.resolve("@playwright/test");
const playwrightEntry = createRequire(testEntry).resolve("playwright");
const coreEntry = createRequire(playwrightEntry).resolve("playwright-core");
const packageRoot = path.dirname(coreEntry);
assert.equal(
	JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"))).version,
	"1.61.1",
);
const bundle = path.join(packageRoot, "lib/coreBundle.js");
const hash = () =>
	crypto.createHash("sha256").update(fs.readFileSync(bundle)).digest("hex");
const expected = hash();
const core = require(bundle);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function barrier() {
	let release;
	const promise = new Promise((resolve) => {
		release = resolve;
	});
	return { promise, release };
}
async function run(dispose) {
	const pw = core.inprocess.createInProcessPlaywright();
	const client = pw._connection;
	const server = client.toImpl(client);
	const impl = client.toImpl(pw);
	const scope = server.existingDispatcher(impl);
	const entered = barrier();
	const resume = barrier();
	const order = [];
	const originalOnMessage = server.onmessage;
	server.onmessage = (message) => {
		order.push(message.method || "result");
		// Explicit malformed-wire fixture; all other cases delegate unchanged.
		originalOnMessage(
			mode === "malformed" && message.id
				? { ...message, result: { response: 7 } }
				: message,
		);
	};
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
	// Only this fresh synthetic SDK object's instrumentation is replaced; vendor bytes stay intact.
	request.instrumentation = {
		onBeforeCall: async () => {},
		onAfterCall: async () => {
			order.push("afterCall-enter");
			entered.release();
			await resume.promise;
		},
		onCallLog: () => {},
	};
	if (mode === "rpc-error")
		requestDispatcher.response = async () => {
			throw new Error("synthetic-rpc-failure");
		};
	await tick();
	let resolved = false;
	let rejected = false;
	let uncaughtCategory = null;
	let rejectedCategory = null;
	let expectedExceptions = 0;
	let unhandledRejections = 0;
	let unexpectedExceptions = 0;
	function category(error) {
		if (
			error.message.includes(
				`Object with guid ${responseDispatcher._guid} was not bound in the connection`,
			)
		)
			return "unknown-guid";
		if (error.message.includes("expected channel")) return "malformed-channel";
		if (error.message.includes("synthetic-rpc-failure")) return "rpc-error";
		return "unexpected";
	}
	function uncaught(error) {
		uncaughtCategory = category(error);
		if (uncaughtCategory === "unexpected") unexpectedExceptions += 1;
		else expectedExceptions += 1;
	}
	process.on("uncaughtException", uncaught);
	const unhandled = () => {
		unhandledRejections += 1;
	};
	process.on("unhandledRejection", unhandled);
	const clientRequest = client.getObjectWithKnownName(requestDispatcher._guid);
	const actualPromise = clientRequest.response();
	actualPromise.then(
		(value) => {
			assert.equal(value.status(), 200);
			resolved = true;
		},
		(error) => {
			rejected = true;
			rejectedCategory = category(error);
		},
	);
	await entered.promise;
	assert.equal(client._objects.has(responseDispatcher._guid), true);
	if (dispose) {
		requestDispatcher._dispose();
		await tick();
		assert.equal(client._objects.has(responseDispatcher._guid), false);
	}
	resume.release();
	await tick();
	await tick();

	assert.equal(unexpectedExceptions, 0);
	const validationFault = mode === "dispose" || mode === "malformed";
	const expectedCategory =
		mode === "dispose"
			? "unknown-guid"
			: mode === "malformed"
				? "malformed-channel"
				: "rpc-error";
	assert.equal(expectedExceptions, 0);
	assert.equal(unhandledRejections, 0);
	assert.equal(resolved, mode === "control");
	assert.equal(rejected, mode === "rpc-error" || validationFault);
	assert.equal(uncaughtCategory, null);
	assert.equal(rejectedCategory, rejected ? expectedCategory : null);
	assert.equal(client._callbacks.size, 0);
	if (dispose)
		assert.ok(order.indexOf("__dispose__") < order.indexOf("result"));
	else requestDispatcher._dispose();
	await tick();
	await tick();
	assert.equal(
		expectedExceptions + unexpectedExceptions + unhandledRejections,
		0,
	);
	process.off("uncaughtException", uncaught);
	process.off("unhandledRejection", unhandled);
	return {
		mode,
		expectedExceptions,
		unexpectedExceptions,
		unhandledRejections,
		observation:
			"two setImmediate turns after barrier release; no universal late-error claim",
		uncaughtCategory,
		resolved,
		callbackRejected: rejected,
		rejectedCategory,
		callbackRemoved: client._callbacks.size === 0,
		order,
	};
}
(async () => {
	const results = [await run(mode === "dispose")];
	assert.equal(hash(), expected);
	console.log(
		JSON.stringify({
			scope:
				"installed Playwright original asynchronous transport and actual client Request.response Promise; synthetic SDK request and explicit disposal; no browser or application",
			bundleSha256: expected,
			node: process.version,
			results,
		}),
	);
})().catch(() => {
	console.error("oracle-failed");
	process.exitCode = 1;
});
