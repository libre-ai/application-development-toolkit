// SPDX-FileCopyrightText: 2026 Libre AI contributors
// SPDX-License-Identifier: Apache-2.0
const fs = require("node:fs");
const path = require("node:path");
const PROJECTS = [
	"chromium-no-js",
	"chromium-pwa",
	"chromium",
	"firefox",
	"webkit",
	"chromium-csrf",
	"unknown",
];
const STATUSES = ["passed", "failed", "timedOut", "skipped", "interrupted"];
function keys(value, expected) {
	return (
		value &&
		typeof value === "object" &&
		Object.keys(value).sort().join(",") === [...expected].sort().join(",")
	);
}
function integer(value) {
	return Number.isSafeInteger(value) && value >= 0;
}
function validateReport(value) {
	return (
		keys(value, [
			"schemaVersion",
			"expected",
			"finalStatus",
			"incomplete",
			"tests",
		]) &&
		value.schemaVersion === "opaque-playwright-tests.v1" &&
		integer(value.expected) &&
		value.expected <= 26 &&
		[null, "passed", "failed", "timedout", "interrupted"].includes(
			value.finalStatus,
		) &&
		typeof value.incomplete === "boolean" &&
		Array.isArray(value.tests) &&
		value.tests.length <= 26 &&
		value.tests.every(
			(row) =>
				keys(row, [
					"ordinal",
					"project",
					"workerIndex",
					"status",
					"durationMs",
					"retry",
					"errorCategory",
				]) &&
				integer(row.ordinal) &&
				row.ordinal > 0 &&
				row.ordinal <= 26 &&
				PROJECTS.includes(row.project) &&
				(row.workerIndex === null ||
					(integer(row.workerIndex) && row.workerIndex < 26)) &&
				STATUSES.includes(row.status) &&
				integer(row.durationMs) &&
				row.durationMs <= 3600000 &&
				row.retry === 0 &&
				["none", "unknown-guid", "other"].includes(row.errorCategory),
		) &&
		new Set(value.tests.map((row) => row.ordinal)).size === value.tests.length
	);
}
class OpaqueReporter {
	constructor(options = {}) {
		this.output = options.output || process.env.TOOLKIT_DIAG_OUTPUT;
		this.ids = new Map();
		this.value = {
			schemaVersion: "opaque-playwright-tests.v1",
			expected: 0,
			finalStatus: null,
			incomplete: false,
			tests: [],
		};
	}
	printsToStdio() {
		return false;
	}
	persist() {
		try {
			fs.writeFileSync(
				path.join(this.output, "tests.json"),
				JSON.stringify(this.value),
				{ mode: 0o600 },
			);
		} catch {
			this.value.incomplete = true;
		}
	}
	onBegin(_config, suite) {
		const tests = suite.allTests();
		this.value.expected = Math.min(tests.length, 26);
		this.value.incomplete ||= tests.length !== 26;
		tests.slice(0, 26).forEach((test, index) => {
			this.ids.set(test, index + 1);
		});
		this.persist();
	}
	onTestEnd(test, result) {
		const ordinal = this.ids.get(test);
		if (
			!ordinal ||
			this.value.tests.some((row) => row.ordinal === ordinal) ||
			result.retry !== 0 ||
			!STATUSES.includes(result.status)
		) {
			this.value.incomplete = true;
			return;
		}
		const project = test.parent.project()?.name;
		const errors = Array.isArray(result.errors) ? result.errors : [];
		const unknownGuid = errors
			.slice(0, 16)
			.some(
				(error) =>
					typeof error.message === "string" &&
					error.message.length <= 65536 &&
					error.message.includes("was not bound in the connection"),
			);
		this.value.tests.push({
			ordinal,
			workerIndex:
				integer(result.workerIndex) && result.workerIndex < 26
					? result.workerIndex
					: null,
			project: PROJECTS.includes(project) ? project : "unknown",
			status: result.status,
			durationMs: Number.isFinite(result.duration)
				? Math.max(0, Math.min(Math.round(result.duration), 3600000))
				: 0,
			retry: 0,
			errorCategory: unknownGuid
				? "unknown-guid"
				: errors.length
					? "other"
					: "none",
		});
		this.persist();
	}
	onEnd(result) {
		this.value.finalStatus = [
			"passed",
			"failed",
			"timedout",
			"interrupted",
		].includes(result.status)
			? result.status
			: null;
		this.value.incomplete ||=
			this.value.tests.length !== this.value.expected ||
			this.value.finalStatus === null;
		this.persist();
	}
}
module.exports = OpaqueReporter;
module.exports.validateReport = validateReport;
