import { dirname } from "node:path";

const REQUIRED_PACKAGE_FILES = [
  "LICENSE",
  "LICENSING.md",
  "LICENSES/LicenseRef-Libre-AI-Brand-1.0.txt",
  "src/assets/libre-ai-mark.svg",
] as const;

export function parseBunPackList(output: string): readonly string[] {
  const lines = output.split(/\r?\n/);
  const files = lines
    .map((line) => /^packed\s+\S+\s+(.+)$/.exec(line)?.[1] ?? null)
    .filter((path): path is string => path !== null);
  const totalFileCounts = lines
    .map((line) => /^Total files:\s+(\d+)$/.exec(line)?.[1] ?? null)
    .filter((count): count is string => count !== null)
    .map(Number);

  if (totalFileCounts.length !== 1 || totalFileCounts[0] !== files.length || files.length === 0) {
    return [];
  }

  return files;
}

export function verifyRequiredPackageContents(files: readonly string[]): readonly string[] {
  if (files.length === 0) return ["package.pack_list_empty"];

  const packed = new Set(files);
  return REQUIRED_PACKAGE_FILES.filter((path) => !packed.has(path)).map(
    (path) => `package.required_file_missing:${path}`,
  );
}

async function main(): Promise<void> {
  const repositoryRoot = dirname(import.meta.dir);
  const packed = Bun.spawnSync(["bun", "pm", "pack", "--dry-run", "--ignore-scripts"], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (packed.exitCode !== 0) {
    throw new Error(
      `package.pack_command_failed:${packed.exitCode}\n${packed.stderr.toString().trim()}`,
    );
  }

  const files = parseBunPackList(packed.stdout.toString());
  const failures = verifyRequiredPackageContents(files);
  if (failures.length > 0) throw new Error(failures.join("\n"));

  console.log(
    `Package contents verified: ${files.length} packed files, ${REQUIRED_PACKAGE_FILES.length} required files present.`,
  );
}

if (import.meta.main) {
  await main();
}
