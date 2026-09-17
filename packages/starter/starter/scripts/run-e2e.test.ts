import { expect, spyOn, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runE2e, runInherited } from "./run-e2e";

test("passes exact Playwright arguments and does not collect on success", async () => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const code = await runE2e(
    ["--project=chromium", "--grep", "a title with spaces", "$(literal)"],
    async (command, args) => {
      calls.push({ command, args });
      return 0;
    },
  );
  expect(code).toBe(0);
  expect(calls).toEqual([
    {
      command: "playwright",
      args: ["test", "--project=chromium", "--grep", "a title with spaces", "$(literal)"],
    },
  ]);
});

for (const diagnostic of [0, 2, "throws"] as const) {
  test(`preserves the test exit code when diagnostic result is ${diagnostic}`, async () => {
    const calls: string[] = [];
    const code = await runE2e([], async (command, args) => {
      calls.push(command);
      if (command === "playwright") return 17;
      expect(args).toEqual([join(import.meta.dir, "summarize-e2e-failures.py")]);
      if (diagnostic === "throws") throw new Error("synthetic diagnostic failure");
      return diagnostic;
    });
    expect(code).toBe(17);
    expect(calls).toEqual(["playwright", "python3"]);
  });
}

test("a failed Playwright launch is nonzero and never retried", async () => {
  const calls: string[] = [];
  expect(
    await runE2e([], async (command) => {
      calls.push(command);
      if (command === "playwright") throw new Error("synthetic launch failure");
      return 0;
    }),
  ).toBe(127);
  expect(calls).toEqual(["playwright", "python3"]);
});

test("the real inherited-stdio launcher preserves a child's exit code", async () => {
  expect(await runInherited(process.execPath, ["-e", "process.exit(19)"])).toBe(19);
});

test("the real launcher does not evaluate arguments as shell code", async () => {
  expect(
    await runInherited(process.execPath, [
      "-e",
      "process.exit(process.argv[1] === '$(literal argument)' ? 0 : 18)",
      "$(literal argument)",
    ]),
  ).toBe(0);
});

test("the actual CLI forwards argv and preserves failure after a failed collector", async () => {
  const directory = await mkdtemp(join(tmpdir(), "e2e-launcher-"));
  try {
    const record = join(directory, "record.json");
    const diagnostic = join(directory, "diagnostic.json");
    const playwright = join(directory, "playwright");
    const python = join(directory, "python3");
    await writeFile(
      playwright,
      `#!${process.execPath}\nawait Bun.write(process.env.E2E_RECORD, JSON.stringify(Bun.argv.slice(2))); process.exit(23);\n`,
    );
    await writeFile(
      python,
      `#!${process.execPath}\nawait Bun.write(process.env.E2E_DIAGNOSTIC, JSON.stringify(Bun.argv.slice(2))); process.exit(2);\n`,
    );
    await chmod(playwright, 0o700);
    await chmod(python, 0o700);
    const child = Bun.spawn(
      [process.execPath, join(import.meta.dir, "run-e2e.ts"), "--grep", "literal space $(value)"],
      {
        cwd: directory,
        env: { PATH: directory, E2E_RECORD: record, E2E_DIAGNOSTIC: diagnostic },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(await child.exited).toBe(23);
    expect(JSON.parse(await readFile(record, "utf8"))).toEqual([
      "test",
      "--grep",
      "literal space $(value)",
    ]);
    expect(JSON.parse(await readFile(diagnostic, "utf8"))).toEqual([
      join(import.meta.dir, "summarize-e2e-failures.py"),
    ]);
    expect(await new Response(child.stdout).text()).toBe("");
    expect(await new Response(child.stderr).text()).toBe("E2E diagnostic unavailable (exit 2)\n");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a child's termination signal remains a failing shell-compatible exit", async () => {
  expect(await runInherited(process.execPath, ["-e", "process.kill(process.pid, 'SIGTERM')"])).toBe(
    143,
  );
});

test("an executable that cannot start is reported as a launch failure", async () => {
  expect(await runInherited(join(import.meta.dir, "missing-playwright-executable"), [])).toBe(127);
});

for (const diagnostic of [2, 127, "throws"] as const) {
  test(`reports only a bounded warning for diagnostic failure ${diagnostic}`, async () => {
    const warning = spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(
        await runE2e([], async (command) => {
          if (command === "playwright") return 17;
          if (diagnostic === "throws") throw new Error("private synthetic details must not escape");
          return diagnostic;
        }),
      ).toBe(17);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledWith(
        `E2E diagnostic unavailable (exit ${diagnostic === "throws" ? 127 : diagnostic})`,
      );
    } finally {
      warning.mockRestore();
    }
  });
}
