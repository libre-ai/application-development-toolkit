import { join } from "node:path";

import { generateCss } from "./generate";
import { CONVERGENCE } from "./palettes";
import { buildColorSystem } from "./system";

export const ADOPTED_PALETTE_SLUG = "convergence" as const;

export function buildAdoptedThemeCss(): string {
  return generateCss(buildColorSystem(CONVERGENCE));
}

async function main(): Promise<void> {
  const destination = join(import.meta.dir, "../src/tokens.css");
  const expected = buildAdoptedThemeCss();

  if (process.argv.includes("--check")) {
    const current = await Bun.file(destination).text();
    if (current !== expected) throw new Error("color.adopted_theme_drift");
    console.log("Adopted color theme is current.");
    return;
  }

  await Bun.write(destination, expected);
  console.log("Generated src/tokens.css from Envol constructif.");
}

if (import.meta.main) {
  await main();
}
