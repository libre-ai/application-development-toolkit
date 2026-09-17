import { compile } from "tailwindcss";

const FOUNDATION = `
@theme {
  --text-sm: 0.875rem;
  --text-sm--line-height: 1.25rem;
}
@tailwind utilities;
`;

export async function buildTailwindUtilities(candidates: readonly string[]): Promise<string> {
  if (
    candidates.length > 100 ||
    candidates.some(
      (candidate) =>
        candidate.length === 0 || candidate.length > 80 || !/^[a-z0-9:[\]./%_-]+$/.test(candidate),
    )
  ) {
    throw new Error("design.tailwind_candidate_invalid");
  }
  const compiler = await compile(FOUNDATION);
  return compiler.build([...new Set(candidates)].sort());
}
