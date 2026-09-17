import {
  type ColorVisionDeficiency,
  contrastRatio,
  oklabDistance,
  type RenderedColor,
  renderColor,
  simulateColorVision,
} from "./color";
import {
  COLOR_FAMILIES,
  type ColorFamily,
  type PaletteDefinition,
  SCALE_STEPS,
  type ScaleStep,
} from "./palettes";

export const THEME_NAMES = ["light", "dark", "dark-high-contrast"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const REQUIRED_SEMANTIC_ROLES = [
  "background",
  "surface",
  "surface-subtle",
  "surface-elevated",
  "surface-overlay",
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-inverse",
  "border-subtle",
  "border-default",
  "border-strong",
  "focus-ring",
  "action-primary",
  "action-primary-hover",
  "action-primary-active",
  "action-secondary",
  "success",
  "warning",
  "danger",
  "info",
  "selection",
  "code-added",
  "code-modified",
  "code-removed",
] as const;
export type RequiredSemanticRole = (typeof REQUIRED_SEMANTIC_ROLES)[number];

export const EXTENDED_SEMANTIC_ROLES = [
  "brand-primary",
  "brand-secondary",
  "state-hover",
  "state-active",
  "state-selected",
  "state-disabled-background",
  "state-disabled-content",
  "state-focus",
  "code-background",
  "code-text",
  "code-comment",
  "code-keyword",
  "code-string",
  "code-number",
  "code-function",
  "code-variable",
  "code-operator",
  "code-border",
  "code-line-highlight",
] as const;
export type ExtendedSemanticRole = (typeof EXTENDED_SEMANTIC_ROLES)[number];
export type SemanticRole = RequiredSemanticRole | ExtendedSemanticRole;

export interface ColorReference {
  family: ColorFamily;
  step: ScaleStep;
}

export interface ScaleColor {
  solid: RenderedColor;
  alphaOnLight: RenderedColor;
  alphaOnDark: RenderedColor;
}

export type PrimitiveScales = Record<ColorFamily, Record<ScaleStep, ScaleColor>>;
export type SemanticTheme = Record<SemanticRole, ColorReference>;

interface MeasuredContrastCheck {
  ratio: number;
  target: number;
  purpose: "normal-text" | "large-text" | "non-text";
  pass: boolean;
  note: string;
}

export interface ContrastCheck extends MeasuredContrastCheck {
  foreground: SemanticRole;
  background: SemanticRole;
}

export interface ComponentContrastCheck extends MeasuredContrastCheck {
  foreground: string;
  background: string;
}

export interface ColorVisionPairRisk {
  first: number;
  second: number;
  distance: number;
}

export interface ColorVisionAudit {
  deficiency: ColorVisionDeficiency;
  minimumDistance: number;
  riskyPairs: readonly ColorVisionPairRisk[];
}

export interface VisualizationTheme {
  categories: readonly RenderedColor[];
  sequential: readonly RenderedColor[];
  divergent: readonly RenderedColor[];
}

export interface ComponentTheme {
  buttonPrimary: {
    background: ColorReference;
    backgroundHover: ColorReference;
    backgroundActive: ColorReference;
    text: ColorReference;
    focus: ColorReference;
    disabledBackground: ColorReference;
    disabledText: ColorReference;
  };
  buttonSecondary: {
    background: ColorReference;
    backgroundHover: ColorReference;
    backgroundActive: ColorReference;
    text: ColorReference;
    border: ColorReference;
    focus: ColorReference;
    disabledBackground: ColorReference;
    disabledText: ColorReference;
  };
  diff: {
    addedBackground: ColorReference;
    addedText: ColorReference;
    addedBorder: ColorReference;
    modifiedBackground: ColorReference;
    modifiedText: ColorReference;
    modifiedBorder: ColorReference;
    removedBackground: ColorReference;
    removedText: ColorReference;
    removedBorder: ColorReference;
  };
  terminal: {
    background: ColorReference;
    text: ColorReference;
    dim: ColorReference;
    prompt: ColorReference;
    command: ColorReference;
    success: ColorReference;
    warning: ColorReference;
    error: ColorReference;
    info: ColorReference;
  };
}

export interface ColorSystem {
  definition: PaletteDefinition;
  primitives: PrimitiveScales;
  semantics: Record<ThemeName, SemanticTheme>;
  components: Record<ThemeName, ComponentTheme>;
  visualization: Record<ThemeName, VisualizationTheme>;
  contrast: Record<ThemeName, readonly ContrastCheck[]>;
  componentContrast: Record<ThemeName, readonly ComponentContrastCheck[]>;
  colorVision: Record<ThemeName, readonly ColorVisionAudit[]>;
}

const NEUTRAL_LIGHTNESS = [
  0.992, 0.975, 0.952, 0.92, 0.875, 0.81, 0.725, 0.625, 0.515, 0.405, 0.29, 0.17,
] as const;
const CHROMATIC_LIGHTNESS = [
  0.985, 0.963, 0.932, 0.892, 0.84, 0.775, 0.7, 0.625, 0.55, 0.475, 0.39, 0.285,
] as const;
const CHROMA_MULTIPLIERS = [
  0.12, 0.2, 0.33, 0.48, 0.64, 0.78, 0.9, 1, 0.96, 0.84, 0.67, 0.48,
] as const;
const ALPHA_VALUES = [
  0.025, 0.04, 0.065, 0.095, 0.13, 0.18, 0.25, 0.34, 0.45, 0.58, 0.72, 0.86,
] as const;

function reference(family: ColorFamily, step: ScaleStep): ColorReference {
  return { family, step };
}

function buildPrimitives(definition: PaletteDefinition): PrimitiveScales {
  const entries = COLOR_FAMILIES.map((family) => {
    const seed = definition.families[family];
    const lightnessCurve = family === "neutral" ? NEUTRAL_LIGHTNESS : CHROMATIC_LIGHTNESS;
    const colors = Object.fromEntries(
      SCALE_STEPS.map((step, index) => {
        const lightness = lightnessCurve[index];
        const multiplier = CHROMA_MULTIPLIERS[index];
        const alpha = ALPHA_VALUES[index];
        if (lightness === undefined || multiplier === undefined || alpha === undefined) {
          throw new Error("color.scale_definition_incomplete");
        }
        const solid = renderColor({
          lightness,
          chroma: seed.maximumChroma * multiplier,
          hue: seed.hue,
        });
        const alphaOnLight = renderColor({
          lightness: family === "neutral" ? 0.18 : 0.36,
          chroma: seed.maximumChroma * (family === "neutral" ? 0.45 : 0.78),
          hue: seed.hue,
          alpha,
        });
        const alphaOnDark = renderColor({
          lightness: family === "neutral" ? 0.95 : 0.82,
          chroma: seed.maximumChroma * (family === "neutral" ? 0.3 : 0.62),
          hue: seed.hue,
          alpha,
        });
        return [step, { solid, alphaOnLight, alphaOnDark } satisfies ScaleColor];
      }),
    ) as Record<ScaleStep, ScaleColor>;
    return [family, colors] as const;
  });
  return Object.fromEntries(entries) as PrimitiveScales;
}

function buildSemanticThemes(): Record<ThemeName, SemanticTheme> {
  const light: SemanticTheme = {
    background: reference("neutral", 2),
    surface: reference("neutral", 1),
    "surface-subtle": reference("neutral", 3),
    "surface-elevated": reference("neutral", 1),
    "surface-overlay": reference("neutral", 1),
    "text-primary": reference("neutral", 12),
    "text-secondary": reference("neutral", 11),
    "text-muted": reference("neutral", 10),
    "text-inverse": reference("neutral", 1),
    "border-subtle": reference("neutral", 5),
    "border-default": reference("neutral", 9),
    "border-strong": reference("neutral", 11),
    "focus-ring": reference("primary", 10),
    "action-primary": reference("primary", 10),
    "action-primary-hover": reference("primary", 11),
    "action-primary-active": reference("primary", 12),
    "action-secondary": reference("neutral", 12),
    success: reference("green", 11),
    warning: reference("amber", 11),
    danger: reference("red", 11),
    info: reference("blue", 11),
    selection: reference("primary", 3),
    "code-added": reference("green", 2),
    "code-modified": reference("amber", 2),
    "code-removed": reference("red", 2),
    "brand-primary": reference("primary", 10),
    "brand-secondary": reference("secondary", 10),
    "state-hover": reference("neutral", 3),
    "state-active": reference("neutral", 4),
    "state-selected": reference("primary", 3),
    "state-disabled-background": reference("neutral", 4),
    "state-disabled-content": reference("neutral", 9),
    "state-focus": reference("primary", 10),
    "code-background": reference("neutral", 2),
    "code-text": reference("neutral", 12),
    "code-comment": reference("neutral", 10),
    "code-keyword": reference("primary", 11),
    "code-string": reference("green", 11),
    "code-number": reference("blue", 11),
    "code-function": reference("secondary", 11),
    "code-variable": reference("neutral", 12),
    "code-operator": reference("neutral", 11),
    "code-border": reference("neutral", 8),
    "code-line-highlight": reference("primary", 2),
  };

  const dark: SemanticTheme = {
    background: reference("neutral", 12),
    surface: reference("neutral", 11),
    "surface-subtle": reference("neutral", 12),
    "surface-elevated": reference("neutral", 10),
    "surface-overlay": reference("neutral", 11),
    "text-primary": reference("neutral", 1),
    "text-secondary": reference("neutral", 3),
    "text-muted": reference("neutral", 7),
    "text-inverse": reference("neutral", 12),
    "border-subtle": reference("neutral", 10),
    "border-default": reference("neutral", 8),
    "border-strong": reference("neutral", 5),
    "focus-ring": reference("primary", 5),
    "action-primary": reference("primary", 7),
    "action-primary-hover": reference("primary", 6),
    "action-primary-active": reference("primary", 8),
    "action-secondary": reference("neutral", 1),
    success: reference("green", 4),
    warning: reference("amber", 4),
    danger: reference("red", 4),
    info: reference("blue", 4),
    selection: reference("primary", 11),
    "code-added": reference("green", 12),
    "code-modified": reference("amber", 12),
    "code-removed": reference("red", 12),
    "brand-primary": reference("primary", 5),
    "brand-secondary": reference("secondary", 5),
    "state-hover": reference("neutral", 11),
    "state-active": reference("neutral", 10),
    "state-selected": reference("primary", 11),
    "state-disabled-background": reference("neutral", 10),
    "state-disabled-content": reference("neutral", 7),
    "state-focus": reference("primary", 5),
    "code-background": reference("neutral", 12),
    "code-text": reference("neutral", 2),
    "code-comment": reference("neutral", 7),
    "code-keyword": reference("primary", 4),
    "code-string": reference("green", 4),
    "code-number": reference("blue", 4),
    "code-function": reference("secondary", 4),
    "code-variable": reference("neutral", 2),
    "code-operator": reference("neutral", 3),
    "code-border": reference("neutral", 9),
    "code-line-highlight": reference("primary", 12),
  };

  const highContrast: SemanticTheme = {
    ...dark,
    surface: reference("neutral", 12),
    "surface-subtle": reference("neutral", 11),
    "surface-elevated": reference("neutral", 10),
    "text-secondary": reference("neutral", 2),
    "text-muted": reference("neutral", 4),
    "border-subtle": reference("neutral", 8),
    "border-default": reference("neutral", 6),
    "border-strong": reference("neutral", 3),
    "focus-ring": reference("primary", 3),
    "action-primary": reference("primary", 5),
    "action-primary-hover": reference("primary", 4),
    "action-primary-active": reference("primary", 6),
    "action-secondary": reference("secondary", 5),
    selection: reference("primary", 10),
    "state-focus": reference("primary", 3),
    "code-comment": reference("neutral", 4),
    "code-border": reference("neutral", 6),
  };

  return { light, dark, "dark-high-contrast": highContrast };
}

export function resolveColor(
  primitives: PrimitiveScales,
  colorReference: ColorReference,
): RenderedColor {
  return primitives[colorReference.family][colorReference.step].solid;
}

function buildComponents(
  semantics: Record<ThemeName, SemanticTheme>,
): Record<ThemeName, ComponentTheme> {
  return Object.fromEntries(
    THEME_NAMES.map((themeName) => {
      const theme = semantics[themeName];
      const dark = themeName !== "light";
      const component: ComponentTheme = {
        buttonPrimary: {
          background: theme["action-primary"],
          backgroundHover: theme["action-primary-hover"],
          backgroundActive: theme["action-primary-active"],
          text: theme["text-inverse"],
          focus: theme["focus-ring"],
          disabledBackground: theme["state-disabled-background"],
          disabledText: theme["state-disabled-content"],
        },
        buttonSecondary: {
          background: theme.surface,
          backgroundHover: theme["state-hover"],
          backgroundActive: theme["state-active"],
          text: theme["action-secondary"],
          border: theme["border-default"],
          focus: theme["focus-ring"],
          disabledBackground: theme["state-disabled-background"],
          disabledText: theme["state-disabled-content"],
        },
        diff: dark
          ? {
              addedBackground: reference("green", 12),
              addedText: reference("green", 3),
              addedBorder: reference("green", 6),
              modifiedBackground: reference("amber", 12),
              modifiedText: reference("amber", 3),
              modifiedBorder: reference("amber", 6),
              removedBackground: reference("red", 12),
              removedText: reference("red", 3),
              removedBorder: reference("red", 6),
            }
          : {
              addedBackground: reference("green", 2),
              addedText: reference("green", 12),
              addedBorder: reference("green", 9),
              modifiedBackground: reference("amber", 2),
              modifiedText: reference("amber", 12),
              modifiedBorder: reference("amber", 9),
              removedBackground: reference("red", 2),
              removedText: reference("red", 12),
              removedBorder: reference("red", 9),
            },
        terminal: dark
          ? {
              background: reference("neutral", 12),
              text: reference("neutral", 2),
              dim: reference("neutral", themeName === "dark-high-contrast" ? 4 : 7),
              prompt: reference("secondary", 4),
              command: reference("primary", 4),
              success: reference("green", 4),
              warning: reference("amber", 4),
              error: reference("red", 4),
              info: reference("blue", 4),
            }
          : {
              background: reference("neutral", 12),
              text: reference("neutral", 2),
              dim: reference("neutral", 7),
              prompt: reference("secondary", 4),
              command: reference("primary", 4),
              success: reference("green", 4),
              warning: reference("amber", 4),
              error: reference("red", 4),
              info: reference("blue", 4),
            },
      };
      return [themeName, component] as const;
    }),
  ) as Record<ThemeName, ComponentTheme>;
}

interface CategoryCandidate {
  color: RenderedColor;
  hue: number;
}

const COLOR_VISION_DEFICIENCIES: readonly ColorVisionDeficiency[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

function circularHueDistance(first: number, second: number): number {
  const direct = Math.abs(first - second) % 360;
  return Math.min(direct, 360 - direct);
}

function minimumVisionDistance(first: RenderedColor, second: RenderedColor): number {
  const distances = [oklabDistance(first.rgb, second.rgb)];
  for (const deficiency of COLOR_VISION_DEFICIENCIES) {
    distances.push(
      oklabDistance(
        simulateColorVision(first.rgb, deficiency),
        simulateColorVision(second.rgb, deficiency),
      ),
    );
  }
  return Math.min(...distances);
}

function buildCategoricalColors(
  definition: PaletteDefinition,
  primitives: PrimitiveScales,
  themeName: ThemeName,
): readonly RenderedColor[] {
  const dark = themeName !== "light";
  const highContrast = themeName === "dark-high-contrast";
  const background = primitives.neutral[dark ? 12 : 2].solid;
  const lightnessValues = dark
    ? highContrast
      ? [0.68, 0.76, 0.84, 0.91]
      : [0.62, 0.7, 0.78, 0.86]
    : [0.34, 0.41, 0.48, 0.55, 0.61];
  const seedHues = [
    definition.families.primary.hue,
    definition.families.secondary.hue,
    definition.families.red.hue,
    definition.families.amber.hue,
    definition.families.green.hue,
    definition.families.blue.hue,
  ];
  const hues = [...new Set([...seedHues, ...Array.from({ length: 18 }, (_, index) => index * 20)])];
  const candidatesByHex = new Map<string, CategoryCandidate>();
  for (const hue of hues) {
    for (const lightness of lightnessValues) {
      for (const chroma of [0.075, 0.105, 0.135]) {
        const color = renderColor({ lightness, chroma, hue });
        if (contrastRatio(color.rgb, background.rgb) < 3) continue;
        candidatesByHex.set(color.hex, { color, hue });
      }
    }
  }
  const candidates = [...candidatesByHex.values()];
  const primaryTarget = candidates
    .filter((candidate) => circularHueDistance(candidate.hue, definition.families.primary.hue) < 1)
    .sort((first, second) => {
      const targetLightness = dark ? 0.7 : 0.48;
      return (
        Math.abs(first.color.oklch.lightness - targetLightness) -
        Math.abs(second.color.oklch.lightness - targetLightness)
      );
    })[0];
  if (primaryTarget === undefined) throw new Error("color.category_primary_missing");

  const selected: CategoryCandidate[] = [primaryTarget];
  while (selected.length < 8) {
    let best: CategoryCandidate | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      if (selected.some((entry) => entry.color.hex === candidate.color.hex)) continue;
      if (selected.some((entry) => circularHueDistance(entry.hue, candidate.hue) < 18)) continue;
      const distance = Math.min(
        ...selected.map((entry) => minimumVisionDistance(entry.color, candidate.color)),
      );
      const identityBonus = seedHues.some((hue) => circularHueDistance(hue, candidate.hue) < 1)
        ? 0.008
        : 0;
      const score = distance + identityBonus;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    if (best === undefined) throw new Error("color.category_generation_exhausted");
    selected.push(best);
  }
  return selected.map((entry) => entry.color);
}

function buildVisualization(
  definition: PaletteDefinition,
  primitives: PrimitiveScales,
): Record<ThemeName, VisualizationTheme> {
  const buildTheme = (themeName: ThemeName): VisualizationTheme => {
    const dark = themeName !== "light";
    const categories = buildCategoricalColors(definition, primitives, themeName);
    const sequentialSteps: readonly ScaleStep[] = dark
      ? [12, 11, 10, 9, 8, 7, 6, 5, 3]
      : [2, 3, 4, 5, 6, 7, 8, 9, 11];
    const sequential = sequentialSteps.map((step) => primitives.primary[step].solid);
    const divergentSteps: readonly ScaleStep[] = dark ? [4, 6, 8, 10, 12] : [11, 9, 7, 5, 3];
    const divergent = [
      ...divergentSteps.map((step) => primitives.red[step].solid),
      primitives.neutral[dark ? 11 : 2].solid,
      ...[...divergentSteps].reverse().map((step) => primitives.blue[step].solid),
    ];
    return { categories, sequential, divergent };
  };
  return {
    light: buildTheme("light"),
    dark: buildTheme("dark"),
    "dark-high-contrast": buildTheme("dark-high-contrast"),
  };
}

interface ContrastPairDefinition {
  foreground: SemanticRole;
  background: SemanticRole;
  target: number;
  purpose: ContrastCheck["purpose"];
  note: string;
}

const CONTRAST_PAIRS: readonly ContrastPairDefinition[] = [
  {
    foreground: "text-primary",
    background: "background",
    target: 7,
    purpose: "normal-text",
    note: "Texte principal — objectif AAA.",
  },
  {
    foreground: "text-primary",
    background: "surface",
    target: 7,
    purpose: "normal-text",
    note: "Texte principal sur surface — objectif AAA.",
  },
  {
    foreground: "text-secondary",
    background: "background",
    target: 4.5,
    purpose: "normal-text",
    note: "Texte secondaire — minimum AA.",
  },
  {
    foreground: "text-muted",
    background: "background",
    target: 4.5,
    purpose: "normal-text",
    note: "Texte atténué mais informatif — minimum AA.",
  },
  {
    foreground: "text-inverse",
    background: "action-primary",
    target: 4.5,
    purpose: "normal-text",
    note: "Libellé du bouton principal.",
  },
  {
    foreground: "action-primary",
    background: "background",
    target: 3,
    purpose: "non-text",
    note: "Contrôle principal contre son environnement.",
  },
  {
    foreground: "focus-ring",
    background: "background",
    target: 3,
    purpose: "non-text",
    note: "Anneau de focus visible.",
  },
  {
    foreground: "border-default",
    background: "background",
    target: 3,
    purpose: "non-text",
    note: "Bord de contrôle ; border-subtle est volontairement exclu.",
  },
  ...(["success", "warning", "danger", "info"] as const).map((role) => ({
    foreground: role,
    background: "background" as const,
    target: 4.5,
    purpose: "normal-text" as const,
    note: `${role} lorsqu’il porte du texte ; une icône ou un libellé reste obligatoire.`,
  })),
  {
    foreground: "text-primary",
    background: "selection",
    target: 4.5,
    purpose: "normal-text",
    note: "Texte sélectionné sur le fond de sélection.",
  },
  {
    foreground: "code-text",
    background: "code-background",
    target: 7,
    purpose: "normal-text",
    note: "Texte principal du code — objectif AAA.",
  },
  ...(
    [
      "code-comment",
      "code-keyword",
      "code-string",
      "code-number",
      "code-function",
      "code-variable",
    ] as const
  ).map((role) => ({
    foreground: role,
    background: "code-background" as const,
    target: 4.5,
    purpose: "normal-text" as const,
    note: `${role} dans un bloc de code — minimum AA.`,
  })),
];

function buildContrastAudit(
  primitives: PrimitiveScales,
  semantics: Record<ThemeName, SemanticTheme>,
): Record<ThemeName, readonly ContrastCheck[]> {
  const buildTheme = (themeName: ThemeName): readonly ContrastCheck[] => {
    const theme = semantics[themeName];
    return CONTRAST_PAIRS.map((pair) => {
      const foreground = resolveColor(primitives, theme[pair.foreground]);
      const background = resolveColor(primitives, theme[pair.background]);
      const ratio = contrastRatio(foreground.rgb, background.rgb);
      return {
        ...pair,
        ratio: Number(ratio.toFixed(2)),
        pass: ratio >= pair.target,
      };
    });
  };
  return {
    light: buildTheme("light"),
    dark: buildTheme("dark"),
    "dark-high-contrast": buildTheme("dark-high-contrast"),
  };
}

function buildComponentContrastAudit(
  primitives: PrimitiveScales,
  components: Record<ThemeName, ComponentTheme>,
): Record<ThemeName, readonly ComponentContrastCheck[]> {
  const buildTheme = (themeName: ThemeName): readonly ComponentContrastCheck[] => {
    const component = components[themeName];
    const checks: ComponentContrastCheck[] = [];
    const add = (
      foreground: string,
      foregroundReference: ColorReference,
      background: string,
      backgroundReference: ColorReference,
      target: number,
      purpose: ComponentContrastCheck["purpose"],
      note: string,
    ): void => {
      const ratio = contrastRatio(
        resolveColor(primitives, foregroundReference).rgb,
        resolveColor(primitives, backgroundReference).rgb,
      );
      checks.push({
        foreground,
        background,
        target,
        purpose,
        note,
        ratio: Number(ratio.toFixed(2)),
        pass: ratio >= target,
      });
    };

    for (const [state, background] of [
      ["default", component.buttonPrimary.background],
      ["hover", component.buttonPrimary.backgroundHover],
      ["active", component.buttonPrimary.backgroundActive],
    ] as const) {
      add(
        "button-primary-text",
        component.buttonPrimary.text,
        `button-primary-${state}`,
        background,
        4.5,
        "normal-text",
        `Libellé du bouton principal à l’état ${state}.`,
      );
    }
    for (const [state, background] of [
      ["default", component.buttonSecondary.background],
      ["hover", component.buttonSecondary.backgroundHover],
      ["active", component.buttonSecondary.backgroundActive],
    ] as const) {
      add(
        "button-secondary-text",
        component.buttonSecondary.text,
        `button-secondary-${state}`,
        background,
        4.5,
        "normal-text",
        `Libellé du bouton secondaire à l’état ${state}.`,
      );
    }
    add(
      "button-secondary-border",
      component.buttonSecondary.border,
      "button-secondary-background",
      component.buttonSecondary.background,
      3,
      "non-text",
      "Frontière visible du bouton secondaire.",
    );
    add(
      "button-disabled-text",
      component.buttonPrimary.disabledText,
      "button-disabled-background",
      component.buttonPrimary.disabledBackground,
      3,
      "large-text",
      "Cible volontaire malgré l’exemption WCAG habituelle des contrôles désactivés.",
    );

    for (const [state, foreground, background, border] of [
      [
        "added",
        component.diff.addedText,
        component.diff.addedBackground,
        component.diff.addedBorder,
      ],
      [
        "modified",
        component.diff.modifiedText,
        component.diff.modifiedBackground,
        component.diff.modifiedBorder,
      ],
      [
        "removed",
        component.diff.removedText,
        component.diff.removedBackground,
        component.diff.removedBorder,
      ],
    ] as const) {
      add(
        `diff-${state}-text`,
        foreground,
        `diff-${state}-background`,
        background,
        4.5,
        "normal-text",
        `Texte de diff ${state}, doublé par signe et libellé.`,
      );
      add(
        `diff-${state}-border`,
        border,
        `diff-${state}-background`,
        background,
        3,
        "non-text",
        `Rail de diff ${state}, doublé par signe et libellé.`,
      );
    }

    for (const [name, foreground, target] of [
      ["text", component.terminal.text, 7],
      ["dim", component.terminal.dim, 4.5],
      ["prompt", component.terminal.prompt, 4.5],
      ["command", component.terminal.command, 4.5],
      ["success", component.terminal.success, 4.5],
      ["warning", component.terminal.warning, 4.5],
      ["error", component.terminal.error, 4.5],
      ["info", component.terminal.info, 4.5],
    ] as const) {
      add(
        `terminal-${name}`,
        foreground,
        "terminal-background",
        component.terminal.background,
        target,
        "normal-text",
        `Canal terminal ${name}, doublé par contenu textuel.`,
      );
    }
    return checks;
  };
  return {
    light: buildTheme("light"),
    dark: buildTheme("dark"),
    "dark-high-contrast": buildTheme("dark-high-contrast"),
  };
}

function buildColorVisionAudit(
  visualization: Record<ThemeName, VisualizationTheme>,
): Record<ThemeName, readonly ColorVisionAudit[]> {
  const deficiencies: readonly ColorVisionDeficiency[] = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
  ];
  const buildTheme = (themeName: ThemeName): readonly ColorVisionAudit[] =>
    deficiencies.map((deficiency) => {
      const simulated = visualization[themeName].categories.map((color) =>
        simulateColorVision(color.rgb, deficiency),
      );
      const risks: ColorVisionPairRisk[] = [];
      let minimumDistance = Number.POSITIVE_INFINITY;
      for (let first = 0; first < simulated.length; first += 1) {
        for (let second = first + 1; second < simulated.length; second += 1) {
          const firstColor = simulated[first];
          const secondColor = simulated[second];
          if (firstColor === undefined || secondColor === undefined) continue;
          const distance = oklabDistance(firstColor, secondColor);
          minimumDistance = Math.min(minimumDistance, distance);
          if (distance < 0.055) {
            risks.push({
              first: first + 1,
              second: second + 1,
              distance: Number(distance.toFixed(4)),
            });
          }
        }
      }
      return {
        deficiency,
        minimumDistance: Number(minimumDistance.toFixed(4)),
        riskyPairs: risks,
      };
    });
  return {
    light: buildTheme("light"),
    dark: buildTheme("dark"),
    "dark-high-contrast": buildTheme("dark-high-contrast"),
  };
}

export function buildColorSystem(definition: PaletteDefinition): ColorSystem {
  const primitives = buildPrimitives(definition);
  const semantics = buildSemanticThemes();
  const components = buildComponents(semantics);
  const visualization = buildVisualization(definition, primitives);
  return {
    definition,
    primitives,
    semantics,
    components,
    visualization,
    contrast: buildContrastAudit(primitives, semantics),
    componentContrast: buildComponentContrastAudit(primitives, components),
    colorVision: buildColorVisionAudit(visualization),
  };
}

export function tokenReference(colorReference: ColorReference): string {
  return `{primitive.${colorReference.family}.solid.${colorReference.step}}`;
}
