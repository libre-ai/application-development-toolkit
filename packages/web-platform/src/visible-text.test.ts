import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revealHiddenCharacters } from "./visible-text";

// Copy of two tables of the candidate served-text preparation vectors. The authority is not
// merged yet, so nothing can be imported or pinned: an absent or unreadable copy must fail
// here (readFileSync throws), never skip.
const COPY_PATH = join(
  import.meta.dir,
  "../fixtures/served-text-preparation-candidate/removed-ranges.copy.json",
);

interface RangeCopy {
  keptNeighbours: number[];
  removedRanges: Array<[number, number]>;
}

function codePoint(hex: unknown): number {
  if (typeof hex !== "string" || !/^[0-9A-F]{4,6}$/.test(hex)) {
    throw new Error("copy: malformed code point");
  }
  return Number.parseInt(hex, 16);
}

function loadCopy(): RangeCopy {
  const parsed: unknown = JSON.parse(readFileSync(COPY_PATH, "utf8"));
  if (typeof parsed !== "object" || parsed === null) throw new Error("copy: not an object");
  const { keptNeighbours, removedRanges } = parsed as Record<string, unknown>;
  if (!Array.isArray(keptNeighbours) || !Array.isArray(removedRanges)) {
    throw new Error("copy: missing table");
  }
  return {
    keptNeighbours: keptNeighbours.map(codePoint),
    removedRanges: removedRanges.map((pair: unknown): [number, number] => {
      if (!Array.isArray(pair) || pair.length !== 2) throw new Error("copy: malformed range");
      return [codePoint(pair[0]), codePoint(pair[1])];
    }),
  };
}

function marker(value: number): string {
  return `[U+${value.toString(16).toUpperCase().padStart(4, "0")}]`;
}

describe("hidden characters made visible", () => {
  test("reveals zero-width, bidirectional and control characters, keeps LF and TAB", () => {
    expect(revealHiddenCharacters("a\u{200B}\u{202E}\n\t\u{1B}")).toBe(
      "a[U+200B][U+202E]\n\t[U+001B]",
    );
    expect(revealHiddenCharacters("x\u{E0001}y")).toBe("x[U+E0001]y");
  });

  test("leaves ASCII, accented text and markup unchanged", () => {
    expect(revealHiddenCharacters("plain text 123")).toBe("plain text 123");
    expect(revealHiddenCharacters("R\u{E9}f\u{E9}rence")).toBe("R\u{E9}f\u{E9}rence");
    expect(revealHiddenCharacters("<script>")).toBe("<script>");
  });

  test("replays the range and neighbour tables of the copied vectors", () => {
    const { keptNeighbours, removedRanges } = loadCopy();
    // SEMANTICS.md of the candidate states 28 ranges and 55 neighbours: a truncated copy fails.
    expect(removedRanges.length).toBe(28);
    expect(keptNeighbours.length).toBe(55);

    // Same shape as the `range` family: first, an interior and the last code point of the range.
    for (const [first, last] of removedRanges) {
      const picked = [...new Set([first, Math.floor((first + last) / 2), last])];
      const input = `x${picked.map((value) => String.fromCodePoint(value)).join("")}y`;
      expect(revealHiddenCharacters(input)).toBe(`x${picked.map(marker).join("")}y`);
    }
    for (const neighbour of keptNeighbours) {
      const input = `x${String.fromCodePoint(neighbour)}y`;
      expect(revealHiddenCharacters(input)).toBe(input);
    }

    // The literal table of the module against the copy, over the whole code space.
    let hidden = 0;
    let visible = 0;
    for (let value = 0; value <= 0x10ffff; value += 1) {
      if (value >= 0xd800 && value <= 0xdfff) continue;
      const expectedHidden = removedRanges.some(([first, last]) => value >= first && value <= last);
      const character = String.fromCodePoint(value);
      if (revealHiddenCharacters(character) !== (expectedHidden ? marker(value) : character)) {
        throw new Error(`class differs from the copy at ${marker(value)}`);
      }
      if (expectedHidden) hidden += 1;
      else visible += 1;
    }

    const replayed = removedRanges.length + keptNeighbours.length;
    console.log(
      `visible-text: ${replayed} vector(s) replayed (${removedRanges.length} range(s), ${keptNeighbours.length} kept neighbour(s)); ${hidden + visible} code point(s) compared (${hidden} hidden, ${visible} visible, 2048 surrogates left out)`,
    );
    expect(replayed).toBeGreaterThan(0);
    expect(hidden + visible + 2048).toBe(0x110000);
  });
});
