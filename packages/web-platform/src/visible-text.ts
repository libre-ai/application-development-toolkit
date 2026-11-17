/**
 * Inclusive code point ranges made visible by `revealHiddenCharacters`.
 *
 * Copy of the `removedRanges` table of the candidate served-text preparation vectors
 * (libre-ai/schemas-and-contracts, contracts/served-text-preparation-candidate/SEMANTICS.md):
 * Default_Ignorable_Code_Point, Cc, Cf, Zl and Zp of Unicode 17.0, minus U+0009 and U+000A.
 * It is a literal, not a property lookup, so the class does not move with the runtime's
 * Unicode version. `visible-text.test.ts` compares it, code point by code point, to the copy
 * of the vectors kept under `fixtures/`.
 */
const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0008],
  [0x000b, 0x001f],
  [0x007f, 0x009f],
  [0x00ad, 0x00ad],
  [0x034f, 0x034f],
  [0x0600, 0x0605],
  [0x061c, 0x061c],
  [0x06dd, 0x06dd],
  [0x070f, 0x070f],
  [0x0890, 0x0891],
  [0x08e2, 0x08e2],
  [0x115f, 0x1160],
  [0x17b4, 0x17b5],
  [0x180b, 0x180f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x206f],
  [0x3164, 0x3164],
  [0xfe00, 0xfe0f],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xfff0, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x1343f],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0000, 0xe0fff],
];

function isHidden(codePoint: number): boolean {
  return HIDDEN_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last);
}

/**
 * Returns `text` with every hidden code point (zero-width, bidirectional, control) replaced
 * by `[U+XXXX]`, uppercase hexadecimal on four to six digits. TAB and LF are kept.
 *
 * The result is plain text, not HTML: nothing is HTML-escaped here, the renderer does it.
 */
export function revealHiddenCharacters(text: string): string {
  let visible = "";
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    visible +=
      codePoint !== undefined && isHidden(codePoint)
        ? `[U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}]`
        : character;
  }
  return visible;
}
