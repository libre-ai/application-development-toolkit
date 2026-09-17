import { spawn } from "node:child_process";
import { constants } from "node:os";
import { join } from "node:path";

type Execute = (command: string, args: readonly string[]) => Promise<number>;

export async function runInherited(command: string, args: readonly string[]): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn(command, [...args], { stdio: "inherit", shell: false });
    child.once("error", () => resolve(127));
    child.once("close", (code, signal) => {
      resolve(code ?? (signal ? 128 + constants.signals[signal] : 1));
    });
  });
}

export async function runE2e(
  args: readonly string[],
  execute: Execute = runInherited,
): Promise<number> {
  let code: number;
  try {
    code = await execute("playwright", ["test", ...args]);
  } catch {
    code = 127;
  }
  if (code === 0) return code;

  // Diagnostic failures must never replace the test failure or trigger a retry.
  let diagnosticCode = 127;
  try {
    diagnosticCode = await execute("python3", [join(import.meta.dir, "summarize-e2e-failures.py")]);
  } catch {
    // The primary exit code remains authoritative even if Python cannot launch.
  }
  if (diagnosticCode !== 0) console.error(`E2E diagnostic unavailable (exit ${diagnosticCode})`);
  return code;
}

if (import.meta.main) process.exitCode = await runE2e(Bun.argv.slice(2));
