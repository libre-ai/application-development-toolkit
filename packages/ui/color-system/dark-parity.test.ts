import { describe, expect, test } from "bun:test";

import { buildAdoptedThemeCss } from "./adopt";
import { compareDarkBlocks, darkBlocks, rawPaletteOverrides } from "./dark-parity";
import { generateCss } from "./generate";
import { CONVERGENCE, PALETTES } from "./palettes";
import {
  buildColorSystem,
  EXTENDED_SEMANTIC_ROLES,
  REQUIRED_SEMANTIC_ROLES,
  resolveColor,
} from "./system";

// Expected selectors and pairs are written out here on purpose: they are the contract of the
// generated sheet, not values read back from the module under test.
const EXPLICIT_OPENER = ':root[data-lai-theme="dark"] {\n';
const HIGH_CONTRAST_OPENER = ':root[data-lai-theme="dark-high-contrast"] {\n';
const AUTOMATIC_SELECTOR =
  ':root:not([data-lai-theme="light"]):not([data-lai-theme="dark"]):not([data-lai-theme="dark-high-contrast"])';
const AUTOMATIC_OPENER = `${AUTOMATIC_SELECTOR} {\n`;
const MEDIA_OPENER = `@media (prefers-color-scheme: dark) {\n  ${AUTOMATIC_OPENER}`;
const PAIRS = [
  "lai-color-semantics/fallback",
  "lai-color-semantics/oklch",
  "lai-color-components/fallback",
  "lai-color-components/oklch",
] as const;
const SURFACE_ROLES = [
  "background",
  "surface",
  "surface-subtle",
  "surface-elevated",
  "surface-overlay",
] as const;

const systems = [...PALETTES, CONVERGENCE].map(buildColorSystem);
const sheets: readonly { label: string; css: string }[] = [
  ...systems.map((system) => ({ label: system.definition.slug, css: generateCss(system) })),
  { label: "adopted", css: buildAdoptedThemeCss() },
];
const realSheet = generateCss(buildColorSystem(CONVERGENCE));

/** Offset just past the given occurrence (0-based) of `opener`; fails when it is absent. */
function afterOccurrence(css: string, opener: string, occurrence: number): number {
  let index = -1;
  for (let seen = 0; seen <= occurrence; seen += 1) {
    index = css.indexOf(opener, index + 1);
    if (index === -1) throw new Error(`fixture.opener_not_found:${occurrence}`);
  }
  return index + opener.length;
}

/** Rewrites the first two declaration lines of one block of the real sheet. */
function mutateBlock(
  opener: string,
  occurrence: number,
  rewrite: (first: string, second: string) => readonly string[],
): string {
  const start = afterOccurrence(realSheet, opener, occurrence);
  const firstEnd = realSheet.indexOf("\n", start);
  const secondEnd = realSheet.indexOf("\n", firstEnd + 1);
  const lines = rewrite(realSheet.slice(start, firstEnd), realSheet.slice(firstEnd + 1, secondEnd));
  const mutated = `${realSheet.slice(0, start)}${lines.join("\n")}${realSheet.slice(secondEnd)}`;
  // A mutation that leaves the sheet untouched would prove nothing.
  expect(mutated).not.toBe(realSheet);
  return mutated;
}

function addDeclaration(opener: string, occurrence: number, declaration: string): string {
  return mutateBlock(opener, occurrence, (first, second) => [declaration, first, second]);
}

function expectGapIn(mutated: string, pair: string): void {
  const gaps = compareDarkBlocks(mutated);
  expect(gaps.length).toBeGreaterThan(0);
  for (const gap of gaps) expect(gap.startsWith(`${pair}: `)).toBe(true);
}

describe("dark block parity", () => {
  test("holds on the four layer and format pairs of every generated sheet", () => {
    let pairCount = 0;
    let comparedDeclarations = 0;

    for (const { css } of sheets) {
      expect(compareDarkBlocks(css)).toEqual([]);

      const blocks = darkBlocks(css);
      const pairsOf = (kind: string): string[] =>
        blocks.filter((block) => block.kind === kind).map((b) => `${b.layer}/${b.format}`);
      expect(pairsOf("explicit")).toEqual([...PAIRS]);
      expect(pairsOf("media")).toEqual([...PAIRS]);
      expect(pairsOf("high-contrast")).toEqual([...PAIRS]);
      expect(blocks).toHaveLength(12);

      for (const block of blocks.filter(({ kind }) => kind === "media")) {
        expect(block.declarations.length).toBeGreaterThan(0);
        pairCount += 1;
        comparedDeclarations += block.declarations.length;
      }
    }

    // Volume examined: a verdict over zero pairs would also read as parity.
    expect(systems.length).toBeGreaterThan(0);
    expect(sheets).toHaveLength(systems.length + 1);
    expect(pairCount).toBe(sheets.length * PAIRS.length);
    expect(comparedDeclarations).toBeGreaterThan(pairCount);
  });

  test("extracts the semantic roles of the automatic block under its exact selector", () => {
    const roles = [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES];
    expect(realSheet.split(MEDIA_OPENER)).toHaveLength(PAIRS.length + 1);

    const media = darkBlocks(realSheet).find(
      (block) => block.kind === "media" && block.layer === "lai-color-semantics",
    );
    const names = media?.declarations.map((declaration) => declaration.name) ?? [];
    expect(names.slice(0, roles.length)).toEqual(roles.map((role) => `--lai-color-${role}`));
  });

  test.each(
    PAIRS.map((pair, index) => [pair, index] as const),
  )("reports a declaration present in one block only (%s)", (pair, index) => {
    const extra = "  --lai-color-extra: #010203;";
    expectGapIn(addDeclaration(AUTOMATIC_OPENER, index, extra), pair);
    expectGapIn(addDeclaration(EXPLICIT_OPENER, index, extra), pair);
    expectGapIn(
      mutateBlock(AUTOMATIC_OPENER, index, (_first, second) => [second]),
      pair,
    );
    expectGapIn(
      mutateBlock(EXPLICIT_OPENER, index, (_first, second) => [second]),
      pair,
    );
  });

  test.each(
    PAIRS.map((pair, index) => [pair, index] as const),
  )("reports two declarations swapped in one block (%s)", (pair, index) => {
    for (const opener of [AUTOMATIC_OPENER, EXPLICIT_OPENER]) {
      const mutated = mutateBlock(opener, index, (first, second) => [second, first]);
      expectGapIn(mutated, pair);
      expect(compareDarkBlocks(mutated).join("\n")).toContain("out of order");
    }
  });

  test.each(
    PAIRS.map((pair, index) => [pair, index] as const),
  )("reports a value that differs for the same name (%s)", (pair, index) => {
    for (const opener of [AUTOMATIC_OPENER, EXPLICIT_OPENER]) {
      const mutated = mutateBlock(opener, index, (first, second) => [
        first.replace(/: [^;]+;$/, ": #010203;"),
        second,
      ]);
      expectGapIn(mutated, pair);
    }
  });

  test("fails with a named error when a dark block cannot be found", () => {
    const start = afterOccurrence(realSheet, AUTOMATIC_OPENER, 0) - AUTOMATIC_OPENER.length;
    const renamed = `${realSheet.slice(0, start)}:root:not([data-lai-theme="light"]) {\n${realSheet.slice(start + AUTOMATIC_OPENER.length)}`;
    expect(renamed).not.toBe(realSheet);

    const missing = "color.dark_parity_block_missing:lai-color-semantics/fallback/media";
    expect(() => darkBlocks(renamed)).toThrow(missing);
    expect(() => compareDarkBlocks(renamed)).toThrow(missing);
    expect(() => rawPaletteOverrides(renamed)).toThrow(missing);
    expect(() => darkBlocks("")).toThrow("color.dark_parity_block_missing");
    expect(() => darkBlocks(realSheet.slice(0, -3))).toThrow("color.dark_parity_unbalanced_css");
  });
});

describe("raw palette immutability", () => {
  test("no dark block of a generated sheet redeclares a raw palette color", () => {
    for (const { css } of sheets) {
      expect(css).toContain("--lai-palette-primary-9:");
      expect(rawPaletteOverrides(css)).toEqual([]);
    }
  });

  test.each(
    PAIRS.map((pair, index) => [pair, index] as const),
  )("lists a raw palette color added to any dark block (%s)", (_pair, index) => {
    const override = "  --lai-palette-primary-9: #010203;";
    for (const opener of [EXPLICIT_OPENER, AUTOMATIC_OPENER, HIGH_CONTRAST_OPENER]) {
      expect(rawPaletteOverrides(addDeclaration(opener, index, override))).toEqual([
        "--lai-palette-primary-9",
      ]);
    }
  });
});

describe("dark surfaces", () => {
  test("every surface role resolves to a different color in dark than in light", () => {
    let compared = 0;
    for (const system of systems) {
      for (const role of SURFACE_ROLES) {
        const light = resolveColor(system.primitives, system.semantics.light[role]).hex;
        const dark = resolveColor(system.primitives, system.semantics.dark[role]).hex;
        expect(light).toMatch(/^#[0-9a-f]{6}$/);
        expect(dark).not.toBe(light);
        compared += 1;
      }
    }
    expect(compared).toBe(systems.length * SURFACE_ROLES.length);
  });
});
