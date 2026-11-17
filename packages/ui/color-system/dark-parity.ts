/**
 * Read-only controls over a generated color sheet (the text rendered by `generateCss`).
 *
 * The generator emits the dark theme twice per layer and per color format: once under the
 * explicit `data-lai-theme="dark"` selector and once under `prefers-color-scheme: dark` for
 * documents that set no theme. Both must carry the same declarations in the same order, and no
 * dark block may redeclare a raw `--lai-palette-*` color: themes remap roles, never primitives.
 *
 * Selectors are matched exactly. A sheet where an expected block cannot be found is an error,
 * never an empty result: an extractor that finds nothing must not read as parity.
 */

export const EXPLICIT_DARK_SELECTOR = ':root[data-lai-theme="dark"]';
export const HIGH_CONTRAST_DARK_SELECTOR = ':root[data-lai-theme="dark-high-contrast"]';
export const AUTOMATIC_DARK_SELECTOR =
  ':root:not([data-lai-theme="light"]):not([data-lai-theme="dark"]):not([data-lai-theme="dark-high-contrast"])';
export const DARK_MEDIA_QUERY = "@media (prefers-color-scheme: dark)";
export const RAW_PALETTE_PREFIX = "--lai-palette-";

export const DARK_BLOCK_KINDS = ["explicit", "media", "high-contrast"] as const;
export type DarkBlockKind = (typeof DARK_BLOCK_KINDS)[number];

export const DARK_BLOCK_FORMATS = ["fallback", "oklch"] as const;
export type DarkBlockFormat = (typeof DARK_BLOCK_FORMATS)[number];

/** Layers in which every format must carry the three dark blocks. */
export const THEMED_LAYERS = ["lai-color-semantics", "lai-color-components"] as const;

export interface DarkDeclaration {
  name: string;
  value: string;
}

export interface DarkBlock {
  kind: DarkBlockKind;
  /** Name of the enclosing `@layer`, or an empty string outside any layer. */
  layer: string;
  format: DarkBlockFormat;
  declarations: readonly DarkDeclaration[];
}

interface ParsedRule {
  prelude: string;
  ancestors: readonly string[];
  declarations: DarkDeclaration[];
}

function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function parseDeclaration(text: string): DarkDeclaration {
  const separator = text.indexOf(":");
  if (separator === -1) {
    throw new Error(`color.dark_parity_malformed_declaration:${normalizeWhitespace(text)}`);
  }
  return {
    name: text.slice(0, separator).trim(),
    value: normalizeWhitespace(text.slice(separator + 1)),
  };
}

function parseRules(css: string): readonly ParsedRule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: ParsedRule[] = [];
  const open: ParsedRule[] = [];
  let start = 0;

  const closeDeclaration = (end: number): void => {
    const pending = text.slice(start, end);
    const current = open.at(-1);
    // A statement outside any rule (`@layer a, b;`) declares nothing.
    if (current !== undefined && pending.trim().length > 0) {
      current.declarations.push(parseDeclaration(pending));
    }
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "{") {
      const rule: ParsedRule = {
        prelude: normalizeWhitespace(text.slice(start, index)),
        ancestors: open.map((ancestor) => ancestor.prelude),
        declarations: [],
      };
      rules.push(rule);
      open.push(rule);
      start = index + 1;
    } else if (character === ";") {
      closeDeclaration(index);
      start = index + 1;
    } else if (character === "}") {
      closeDeclaration(index);
      if (open.pop() === undefined) throw new Error("color.dark_parity_unbalanced_css");
      start = index + 1;
    }
  }
  if (open.length > 0) throw new Error("color.dark_parity_unbalanced_css");
  return rules;
}

function darkKind(rule: ParsedRule): DarkBlockKind | undefined {
  if (rule.prelude === EXPLICIT_DARK_SELECTOR) return "explicit";
  if (rule.prelude === HIGH_CONTRAST_DARK_SELECTOR) return "high-contrast";
  if (rule.prelude === AUTOMATIC_DARK_SELECTOR && rule.ancestors.includes(DARK_MEDIA_QUERY)) {
    return "media";
  }
  return undefined;
}

function layerOf(rule: ParsedRule): string {
  for (const ancestor of rule.ancestors) {
    const match = /^@layer (\S+)$/.exec(ancestor);
    if (match?.[1] !== undefined) return match[1];
  }
  return "";
}

function blockLabel(block: Pick<DarkBlock, "kind" | "layer" | "format">): string {
  return `${block.layer}/${block.format}/${block.kind}`;
}

/**
 * Extracts every dark block of a generated sheet, in source order.
 *
 * Throws `color.dark_parity_block_missing:<layer>/<format>/<kind>` when one of the themed layers
 * lacks a dark block, and `color.dark_parity_block_duplicate:<…>` when a block appears twice.
 */
export function darkBlocks(css: string): readonly DarkBlock[] {
  const blocks: DarkBlock[] = [];
  const seen = new Set<string>();
  for (const rule of parseRules(css)) {
    const kind = darkKind(rule);
    if (kind === undefined) continue;
    const block: DarkBlock = {
      kind,
      layer: layerOf(rule),
      format: rule.ancestors.some((ancestor) => ancestor.startsWith("@supports"))
        ? "oklch"
        : "fallback",
      declarations: rule.declarations,
    };
    const label = blockLabel(block);
    if (seen.has(label)) throw new Error(`color.dark_parity_block_duplicate:${label}`);
    seen.add(label);
    blocks.push(block);
  }

  for (const layer of THEMED_LAYERS) {
    for (const format of DARK_BLOCK_FORMATS) {
      for (const kind of DARK_BLOCK_KINDS) {
        const label = blockLabel({ kind, layer, format });
        if (!seen.has(label)) throw new Error(`color.dark_parity_block_missing:${label}`);
      }
    }
  }
  return blocks;
}

function comparePair(
  label: string,
  explicit: readonly DarkDeclaration[],
  media: readonly DarkDeclaration[],
): readonly string[] {
  const identical =
    explicit.length === media.length &&
    explicit.every(
      (declaration, index) =>
        declaration.name === media[index]?.name && declaration.value === media[index]?.value,
    );
  if (identical) return [];

  const messages: string[] = [];
  const explicitValues = new Map(explicit.map(({ name, value }) => [name, value]));
  const mediaValues = new Map(media.map(({ name, value }) => [name, value]));
  for (const [name, value] of explicitValues) {
    const mediaValue = mediaValues.get(name);
    if (mediaValue === undefined) {
      messages.push(`${label}: ${name} is missing from the media block`);
    } else if (mediaValue !== value) {
      messages.push(`${label}: ${name} is ${value} in the explicit block, ${mediaValue} in media`);
    }
  }
  for (const name of mediaValues.keys()) {
    if (!explicitValues.has(name)) {
      messages.push(`${label}: ${name} is missing from the explicit block`);
    }
  }
  if (messages.length > 0) return messages;

  const position = explicit.findIndex(
    (declaration, index) => declaration.name !== media[index]?.name,
  );
  // Same names and values, yet not identical: either the order or a repeated name differs.
  return [
    position === -1
      ? `${label}: the blocks repeat a declaration differently`
      : `${label}: ${explicit[position]?.name} is out of order (position ${position + 1})`,
  ];
}

/**
 * Compares, for each layer and format, the ordered declarations of the explicit dark block and
 * of the automatic `prefers-color-scheme` block. Returns one message per gap, none on parity.
 */
export function compareDarkBlocks(css: string): readonly string[] {
  const pairs = new Map<string, Partial<Record<DarkBlockKind, DarkBlock>>>();
  for (const block of darkBlocks(css)) {
    if (block.kind === "high-contrast") continue;
    const label = `${block.layer}/${block.format}`;
    pairs.set(label, { ...pairs.get(label), [block.kind]: block });
  }

  const messages: string[] = [];
  for (const [label, pair] of pairs) {
    if (pair.explicit === undefined) {
      messages.push(`${label}: the media block has no explicit counterpart`);
    } else if (pair.media === undefined) {
      messages.push(`${label}: the explicit block has no media counterpart`);
    } else {
      messages.push(...comparePair(label, pair.explicit.declarations, pair.media.declarations));
    }
  }
  return messages;
}

/**
 * Names of the raw palette colors redeclared in any dark block (explicit, high contrast or
 * automatic), in source order. Expected to be empty: a theme never overrides a primitive.
 */
export function rawPaletteOverrides(css: string): readonly string[] {
  return darkBlocks(css).flatMap((block) =>
    block.declarations
      .map((declaration) => declaration.name)
      .filter((name) => name.startsWith(RAW_PALETTE_PREFIX)),
  );
}
