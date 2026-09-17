import { expect, test } from "bun:test";
import { withDiagnosticCleanup } from "./diagnostic-cleanup";

test("runs diagnostic cleanup after a successful scenario", async () => {
  const calls: string[] = [];
  await withDiagnosticCleanup(
    async () => {
      calls.push("scenario");
    },
    async () => {
      calls.push("cleanup");
    },
  );
  expect(calls).toEqual(["scenario", "cleanup"]);
});

test("preserves the scenario error when cleanup succeeds", async () => {
  const primary = new Error("scenario failed");
  let cleaned = false;
  await expect(
    withDiagnosticCleanup(
      async () => {
        throw primary;
      },
      async () => {
        cleaned = true;
      },
    ),
  ).rejects.toBe(primary);
  expect(cleaned).toBe(true);
});

test("fails when only diagnostic cleanup fails", async () => {
  const cleanup = new Error("cleanup failed");
  await expect(
    withDiagnosticCleanup(
      async () => {},
      async () => {
        throw cleanup;
      },
    ),
  ).rejects.toBe(cleanup);
});

test("reports the scenario first when diagnostic cleanup also fails", async () => {
  const primary = new Error("navigation failed");
  const cleanup = new Error("session closed");
  let observed: unknown = null;
  try {
    await withDiagnosticCleanup(
      async () => {
        throw primary;
      },
      async () => {
        throw cleanup;
      },
    );
  } catch (error: unknown) {
    observed = error;
  }
  expect(observed).toBeInstanceOf(AggregateError);
  if (!(observed instanceof AggregateError)) throw new Error("Expected both errors");
  expect(observed.errors).toEqual([primary, cleanup]);
  expect(observed.cause).toBe(primary);
});
