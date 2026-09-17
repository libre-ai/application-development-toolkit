import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { contrastRatio, type RenderedColor } from "./color";
import {
  CONVERGENCE,
  PALETTES,
  type PaletteDefinition,
  SCALE_STEPS,
  SCORE_CRITERIA,
  SCORE_LABELS,
} from "./palettes";
import {
  buildColorSystem,
  type ColorReference,
  type ColorSystem,
  type ComponentTheme,
  EXTENDED_SEMANTIC_ROLES,
  REQUIRED_SEMANTIC_ROLES,
  resolveColor,
  type SemanticRole,
  THEME_NAMES,
  type ThemeName,
  tokenReference,
} from "./system";

const OUTPUT_DIRECTORY = join(import.meta.dir, "generated");
const CHECK_MODE = process.argv.includes("--check");
const FORMAT_VERSION = "libre-ai.color-system-exploration.v1";
const DTCG_SCHEMA = "https://www.designtokens.org/schemas/2025.10/format.json";

interface GeneratedFile {
  path: string;
  content: string;
}

interface DtcgColorValue {
  colorSpace: "oklch";
  components: [number, number, number];
  alpha: number;
}

function formatNumber(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function scoreAverage(definition: PaletteDefinition): number {
  const total = SCORE_CRITERIA.reduce((sum, criterion) => sum + definition.scores[criterion], 0);
  return total / SCORE_CRITERIA.length;
}

function colorHex(color: RenderedColor): string {
  return color.oklch.alpha < 1 ? color.hexWithAlpha : color.hex;
}

function dtcgColor(color: RenderedColor): {
  $value: DtcgColorValue;
  $extensions: { libreAI: { rgb: string; hexFallback: string } };
} {
  return {
    $value: {
      colorSpace: "oklch",
      components: [
        formatNumber(color.oklch.lightness),
        formatNumber(color.oklch.chroma),
        formatNumber(color.oklch.hue, 2),
      ],
      alpha: formatNumber(color.oklch.alpha),
    },
    $extensions: {
      libreAI: {
        rgb: color.rgbCss,
        hexFallback: colorHex(color),
      },
    },
  };
}

function componentReferences(component: ComponentTheme): Record<string, ColorReference> {
  return {
    "button-primary-background": component.buttonPrimary.background,
    "button-primary-background-hover": component.buttonPrimary.backgroundHover,
    "button-primary-background-active": component.buttonPrimary.backgroundActive,
    "button-primary-text": component.buttonPrimary.text,
    "button-primary-focus": component.buttonPrimary.focus,
    "button-primary-disabled-background": component.buttonPrimary.disabledBackground,
    "button-primary-disabled-text": component.buttonPrimary.disabledText,
    "button-secondary-background": component.buttonSecondary.background,
    "button-secondary-background-hover": component.buttonSecondary.backgroundHover,
    "button-secondary-background-active": component.buttonSecondary.backgroundActive,
    "button-secondary-text": component.buttonSecondary.text,
    "button-secondary-border": component.buttonSecondary.border,
    "button-secondary-focus": component.buttonSecondary.focus,
    "button-secondary-disabled-background": component.buttonSecondary.disabledBackground,
    "button-secondary-disabled-text": component.buttonSecondary.disabledText,
    "diff-added-background": component.diff.addedBackground,
    "diff-added-text": component.diff.addedText,
    "diff-added-border": component.diff.addedBorder,
    "diff-modified-background": component.diff.modifiedBackground,
    "diff-modified-text": component.diff.modifiedText,
    "diff-modified-border": component.diff.modifiedBorder,
    "diff-removed-background": component.diff.removedBackground,
    "diff-removed-text": component.diff.removedText,
    "diff-removed-border": component.diff.removedBorder,
    "terminal-background": component.terminal.background,
    "terminal-text": component.terminal.text,
    "terminal-dim": component.terminal.dim,
    "terminal-prompt": component.terminal.prompt,
    "terminal-command": component.terminal.command,
    "terminal-success": component.terminal.success,
    "terminal-warning": component.terminal.warning,
    "terminal-error": component.terminal.error,
    "terminal-info": component.terminal.info,
  };
}

const COMPONENT_SEMANTIC_ALIASES: Readonly<Record<string, SemanticRole>> = {
  "button-primary-background": "action-primary",
  "button-primary-background-hover": "action-primary-hover",
  "button-primary-background-active": "action-primary-active",
  "button-primary-text": "text-inverse",
  "button-primary-focus": "focus-ring",
  "button-primary-disabled-background": "state-disabled-background",
  "button-primary-disabled-text": "state-disabled-content",
  "button-secondary-background": "surface",
  "button-secondary-background-hover": "state-hover",
  "button-secondary-background-active": "state-active",
  "button-secondary-text": "action-secondary",
  "button-secondary-border": "border-default",
  "button-secondary-focus": "focus-ring",
  "button-secondary-disabled-background": "state-disabled-background",
  "button-secondary-disabled-text": "state-disabled-content",
  "diff-added-background": "code-added",
  "diff-modified-background": "code-modified",
  "diff-removed-background": "code-removed",
};

function componentTokenReference(
  themeName: ThemeName,
  name: string,
  colorReference: ColorReference,
): string {
  const semanticRole = COMPONENT_SEMANTIC_ALIASES[name];
  return semanticRole === undefined
    ? tokenReference(colorReference)
    : `{semantic.${themeName}.${semanticRole}}`;
}

function generateDtcgTokens(system: ColorSystem): string {
  const primitive = Object.fromEntries(
    Object.entries(system.primitives).map(([family, scale]) => [
      family,
      {
        $description:
          system.definition.families[family as keyof typeof system.definition.families].label,
        solid: {
          $type: "color",
          ...Object.fromEntries(
            SCALE_STEPS.map((step) => [String(step), dtcgColor(scale[step].solid)]),
          ),
        },
        alpha: {
          onLight: {
            $type: "color",
            ...Object.fromEntries(
              SCALE_STEPS.map((step) => [String(step), dtcgColor(scale[step].alphaOnLight)]),
            ),
          },
          onDark: {
            $type: "color",
            ...Object.fromEntries(
              SCALE_STEPS.map((step) => [String(step), dtcgColor(scale[step].alphaOnDark)]),
            ),
          },
        },
      },
    ]),
  );

  const semantic = Object.fromEntries(
    THEME_NAMES.map((themeName) => [
      themeName,
      {
        $type: "color",
        ...Object.fromEntries(
          [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES].map((role) => [
            role,
            { $value: tokenReference(system.semantics[themeName][role]) },
          ]),
        ),
      },
    ]),
  );

  const component = Object.fromEntries(
    THEME_NAMES.map((themeName) => [
      themeName,
      {
        $type: "color",
        ...Object.fromEntries(
          Object.entries(componentReferences(system.components[themeName])).map(([name, value]) => [
            name,
            { $value: componentTokenReference(themeName, name, value) },
          ]),
        ),
      },
    ]),
  );

  const visualization = Object.fromEntries(
    THEME_NAMES.map((themeName) => [
      themeName,
      {
        category: {
          $type: "color",
          ...Object.fromEntries(
            system.visualization[themeName].categories.map((color, index) => [
              String(index + 1),
              dtcgColor(color),
            ]),
          ),
        },
        sequential: {
          $type: "color",
          ...Object.fromEntries(
            system.visualization[themeName].sequential.map((color, index) => [
              String(index + 1),
              dtcgColor(color),
            ]),
          ),
        },
        divergent: {
          $type: "color",
          ...Object.fromEntries(
            system.visualization[themeName].divergent.map((color, index) => [
              String(index + 1),
              dtcgColor(color),
            ]),
          ),
        },
      },
    ]),
  );

  return `${JSON.stringify(
    {
      $schema: DTCG_SCHEMA,
      $extensions: {
        libreAI: {
          format: FORMAT_VERSION,
          proposal: system.definition.slug,
          status: system.definition.slug === "convergence" ? "adopted" : "exploration",
          normative: system.definition.slug === "convergence",
        },
      },
      primitive,
      semantic,
      component,
      visualization,
    },
    null,
    2,
  )}\n`;
}

type CssColorFormat = "fallback" | "oklch";

function cssVariable(
  name: string,
  color: RenderedColor,
  format: CssColorFormat,
  indentation = "  ",
): string {
  return `${indentation}${name}: ${format === "fallback" ? colorHex(color) : color.css};`;
}

function semanticDeclarations(
  system: ColorSystem,
  themeName: ThemeName,
  format: CssColorFormat,
): string {
  return [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES]
    .map((role) =>
      cssVariable(
        `--lai-color-${role}`,
        resolveColor(system.primitives, system.semantics[themeName][role]),
        format,
      ),
    )
    .join("\n");
}

function componentDeclarations(
  system: ColorSystem,
  themeName: ThemeName,
  format: CssColorFormat,
): string {
  return Object.entries(componentReferences(system.components[themeName]))
    .map(([name, colorReference]) => {
      const semanticRole = COMPONENT_SEMANTIC_ALIASES[name];
      return semanticRole === undefined
        ? cssVariable(
            `--lai-component-${name}`,
            resolveColor(system.primitives, colorReference),
            format,
          )
        : `  --lai-component-${name}: var(--lai-color-${semanticRole});`;
    })
    .join("\n");
}

function visualizationDeclarations(
  system: ColorSystem,
  themeName: ThemeName,
  format: CssColorFormat,
): string {
  const theme = system.visualization[themeName];
  return [
    ...theme.categories.map((color, index) =>
      cssVariable(`--lai-data-category-${index + 1}`, color, format),
    ),
    ...theme.sequential.map((color, index) =>
      cssVariable(`--lai-data-sequential-${index + 1}`, color, format),
    ),
    ...theme.divergent.map((color, index) =>
      cssVariable(`--lai-data-divergent-${index + 1}`, color, format),
    ),
  ].join("\n");
}

function selectorFor(themeName: ThemeName, automatic = false): string {
  if (automatic) {
    return ':root:not([data-lai-theme="light"]):not([data-lai-theme="dark"]):not([data-lai-theme="dark-high-contrast"])';
  }
  if (themeName === "light") return ':root, :root[data-lai-theme="light"]';
  return `:root[data-lai-theme="${themeName}"]`;
}

function semanticThemeBlock(
  system: ColorSystem,
  themeName: ThemeName,
  format: CssColorFormat,
  automatic = false,
): string {
  return `${selectorFor(themeName, automatic)} {\n${semanticDeclarations(system, themeName, format)}\n${visualizationDeclarations(system, themeName, format)}\n}`;
}

function componentThemeBlock(
  system: ColorSystem,
  themeName: ThemeName,
  format: CssColorFormat,
  automatic = false,
): string {
  return `${selectorFor(themeName, automatic)} {\n${componentDeclarations(system, themeName, format)}\n}`;
}

function formatThemeBlocks(
  system: ColorSystem,
  format: CssColorFormat,
  layer: "semantic" | "component",
): string {
  const block = layer === "semantic" ? semanticThemeBlock : componentThemeBlock;
  const automaticDark = block(system, "dark", format, true)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `${block(system, "light", format)}\n\n${block(system, "dark", format)}\n\n${block(
    system,
    "dark-high-contrast",
    format,
  )}\n\n@media (prefers-color-scheme: dark) {\n${automaticDark}\n}`;
}

function primitiveDeclarations(system: ColorSystem, format: CssColorFormat): string {
  return Object.entries(system.primitives)
    .flatMap(([family, scale]) =>
      SCALE_STEPS.flatMap((step) => [
        cssVariable(`--lai-palette-${family}-${step}`, scale[step].solid, format),
        cssVariable(
          `--lai-palette-${family}-alpha-on-light-${step}`,
          scale[step].alphaOnLight,
          format,
        ),
        cssVariable(
          `--lai-palette-${family}-alpha-on-dark-${step}`,
          scale[step].alphaOnDark,
          format,
        ),
      ]),
    )
    .join("\n");
}

export function generateCss(system: ColorSystem): string {
  const fallbackPrimitives = primitiveDeclarations(system, "fallback");
  const modernPrimitives = primitiveDeclarations(system, "oklch");
  const fallbackSemantics = formatThemeBlocks(system, "fallback", "semantic");
  const modernSemantics = formatThemeBlocks(system, "oklch", "semantic");
  const fallbackComponents = formatThemeBlocks(system, "fallback", "component");
  const modernComponents = formatThemeBlocks(system, "oklch", "component");

  return `/* Generated by packages/ui/color-system/generate.ts. Do not edit. */\n@layer lai-color-primitives, lai-color-semantics, lai-color-components;\n\n@layer lai-color-primitives {\n  :root {\n${fallbackPrimitives}\n  }\n\n  @supports (color: oklch(0 0 0)) {\n    :root {\n${modernPrimitives}\n    }\n  }\n}\n\n@layer lai-color-semantics {\n${fallbackSemantics}\n\n@supports (color: oklch(0 0 0)) {\n${modernSemantics}\n}\n}\n\n@layer lai-color-components {\n${fallbackComponents}\n\n@supports (color: oklch(0 0 0)) {\n${modernComponents}\n}\n}\n\n@media (forced-colors: active) {\n  :root {\n    --lai-color-background: Canvas;\n    --lai-color-surface: Canvas;\n    --lai-color-surface-subtle: Canvas;\n    --lai-color-surface-elevated: Canvas;\n    --lai-color-surface-overlay: Canvas;\n    --lai-color-text-primary: CanvasText;\n    --lai-color-text-secondary: CanvasText;\n    --lai-color-text-muted: GrayText;\n    --lai-color-text-inverse: HighlightText;\n    --lai-color-border-subtle: CanvasText;\n    --lai-color-border-default: CanvasText;\n    --lai-color-border-strong: CanvasText;\n    --lai-color-focus-ring: Highlight;\n    --lai-color-action-primary: ButtonFace;\n    --lai-color-action-primary-hover: Highlight;\n    --lai-color-action-primary-active: Highlight;\n    --lai-color-action-secondary: ButtonText;\n    --lai-color-brand-primary: LinkText;\n    --lai-color-brand-secondary: LinkText;\n    --lai-color-selection: Highlight;\n  }\n}\n`;
}

function generateTailwindCss(): string {
  const roles = [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES];
  return `/* Tailwind CSS 4.3 CSS-first configuration. */\n@import "./theme.css";\n\n@theme inline {\n${roles
    .map((role) => `  --color-${role}: var(--lai-color-${role});`)
    .join("\n")}\n}\n\n@tailwind utilities;\n`;
}

interface DiscouragedPairCheck {
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  target: number;
  pass: boolean;
  reason: string;
}

function discouragedPairChecks(system: ColorSystem): readonly DiscouragedPairCheck[] {
  const checks: DiscouragedPairCheck[] = [];
  const add = (
    label: string,
    foregroundName: string,
    foreground: RenderedColor,
    backgroundName: string,
    background: RenderedColor,
    target: number,
    reason: string,
  ): void => {
    const ratio = contrastRatio(foreground.rgb, background.rgb);
    checks.push({
      label,
      foreground: foregroundName,
      background: backgroundName,
      ratio: Number(ratio.toFixed(2)),
      target,
      pass: ratio >= target,
      reason,
    });
  };

  const light = system.semantics.light;
  const dark = system.semantics.dark;
  const lightBackground = resolveColor(system.primitives, light.background);
  const darkBackground = resolveColor(system.primitives, dark.background);
  add(
    "light-border-subtle-as-control",
    "border-subtle",
    resolveColor(system.primitives, light["border-subtle"]),
    "background",
    lightBackground,
    3,
    "border-subtle est décoratif ; un contrôle exige border-default.",
  );
  add(
    "dark-border-subtle-as-control",
    "border-subtle",
    resolveColor(system.primitives, dark["border-subtle"]),
    "background",
    darkBackground,
    3,
    "border-subtle est décoratif ; un contrôle exige border-default.",
  );
  for (const family of ["primary", "secondary", "red", "amber", "green", "blue"] as const) {
    add(
      `light-${family}-8-as-normal-text`,
      `${family}.8`,
      system.primitives[family][8].solid,
      "background",
      lightBackground,
      4.5,
      "Le pas 8 est une marque ou bordure, pas du texte normal.",
    );
    add(
      `light-inverse-on-${family}-8`,
      "text-inverse",
      resolveColor(system.primitives, light["text-inverse"]),
      `${family}.8`,
      system.primitives[family][8].solid,
      4.5,
      "Un aplat brut ne reçoit pas automatiquement un texte clair.",
    );
  }
  for (const [index, category] of system.visualization.light.categories.entries()) {
    add(
      `light-category-${index + 1}-as-normal-text`,
      `visualization.category.${index + 1}`,
      category,
      "background",
      lightBackground,
      4.5,
      "La catégorie est qualifiée comme marque graphique à 3:1, pas comme texte.",
    );
  }
  return checks;
}

function contrastAuditJson(system: ColorSystem): string {
  const failures = THEME_NAMES.flatMap((themeName) => [
    ...system.contrast[themeName]
      .filter((check) => !check.pass)
      .map((check) => ({ layer: "semantic", theme: themeName, ...check })),
    ...system.componentContrast[themeName]
      .filter((check) => !check.pass)
      .map((check) => ({ layer: "component", theme: themeName, ...check })),
  ]);
  const warnings = THEME_NAMES.flatMap((themeName) =>
    system.colorVision[themeName].flatMap((audit) =>
      audit.riskyPairs.map((risk) => ({ theme: themeName, deficiency: audit.deficiency, ...risk })),
    ),
  );
  return `${JSON.stringify(
    {
      format: FORMAT_VERSION,
      proposal: system.definition.slug,
      scope: "Measured token pairs only; this is not a WCAG conformance claim.",
      contrast: system.contrast,
      componentContrast: system.componentContrast,
      failures,
      discouragedPairs: discouragedPairChecks(system),
      colorVision: system.colorVision,
      colorVisionWarnings: warnings,
      limitations: [
        "WCAG ratios use sRGB fallback values and opaque semantic colors.",
        "Color-vision matrices are screening approximations, not clinical simulation.",
        "Categorical data must also use labels, shapes, line styles or patterns.",
        "Disabled controls are not used to communicate required information.",
        "Print and HDR/P3 rendering require separate physical qualification.",
      ],
    },
    null,
    2,
  )}\n`;
}

function markdownColor(color: RenderedColor): string {
  return `${color.css} · \`${colorHex(color)}\` · \`${color.rgbCss}\``;
}

function scaleTables(system: ColorSystem): string {
  return Object.entries(system.primitives)
    .map(([family, scale]) => {
      const label =
        system.definition.families[family as keyof typeof system.definition.families].label;
      const rows = SCALE_STEPS.map((step) => {
        const value = scale[step];
        return `| ${step} | ${markdownColor(value.solid)} | ${markdownColor(value.alphaOnLight)} | ${markdownColor(value.alphaOnDark)} |`;
      }).join("\n");
      return `### ${family} — ${label}\n\n| Étape | Opaque | Alpha sur clair | Alpha sur sombre |\n| ---: | --- | --- | --- |\n${rows}`;
    })
    .join("\n\n");
}

function semanticTables(system: ColorSystem): string {
  const roles = [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES];
  return THEME_NAMES.map((themeName) => {
    const rows = roles
      .map((role) => {
        const colorReference = system.semantics[themeName][role];
        const color = resolveColor(system.primitives, colorReference);
        return `| ${role} | ${colorReference.family}.${colorReference.step} | ${markdownColor(color)} |`;
      })
      .join("\n");
    return `### ${themeName}\n\n| Rôle | Primitive | Valeur |\n| --- | --- | --- |\n${rows}`;
  }).join("\n\n");
}

function contrastTables(system: ColorSystem): string {
  return THEME_NAMES.map((themeName) => {
    const semanticRows = system.contrast[themeName]
      .map(
        (check) =>
          `| ${check.foreground} / ${check.background} | ${check.ratio}:1 | ${check.target}:1 | ${check.pass ? "PASS" : "ÉCHEC"} | ${check.note} |`,
      )
      .join("\n");
    const componentRows = system.componentContrast[themeName]
      .map(
        (check) =>
          `| ${check.foreground} / ${check.background} | ${check.ratio}:1 | ${check.target}:1 | ${check.pass ? "PASS" : "ÉCHEC"} | ${check.note} |`,
      )
      .join("\n");
    return `### ${themeName}\n\n#### Rôles sémantiques\n\n| Association | Mesure | Cible | Résultat | Usage |\n| --- | ---: | ---: | --- | --- |\n${semanticRows}\n\n#### Composants et états\n\n| Association | Mesure | Cible | Résultat | Usage |\n| --- | ---: | ---: | --- | --- |\n${componentRows}`;
  }).join("\n\n");
}

function visualizationTables(system: ColorSystem): string {
  return THEME_NAMES.map((themeName) => {
    const visualization = system.visualization[themeName];
    const rows = [
      ["Catégories", visualization.categories],
      ["Séquentiel", visualization.sequential],
      ["Divergent", visualization.divergent],
    ] as const;
    return `### ${themeName}\n\n${rows
      .map(
        ([name, colors]) =>
          `- **${name} :** ${colors.map((color, index) => `${index + 1} ${color.hex}`).join(" · ")}`,
      )
      .join("\n")}`;
  }).join("\n\n");
}

function scoreTable(definition: PaletteDefinition): string {
  return SCORE_CRITERIA.map(
    (criterion) => `| ${SCORE_LABELS[criterion]} | ${definition.scores[criterion]}/10 |`,
  ).join("\n");
}

function explicitFailureSummary(system: ColorSystem): string {
  const criticalFailures = THEME_NAMES.flatMap((themeName) => [
    ...system.contrast[themeName]
      .filter((check) => !check.pass)
      .map(
        (check) =>
          `- **CRITIQUE ${themeName} — ${check.foreground}/${check.background} : ${check.ratio}:1**, sous la cible ${check.target}:1.`,
      ),
    ...system.componentContrast[themeName]
      .filter((check) => !check.pass)
      .map(
        (check) =>
          `- **CRITIQUE COMPOSANT ${themeName} — ${check.foreground}/${check.background} : ${check.ratio}:1**, sous la cible ${check.target}:1.`,
      ),
  ]);
  const forbiddenFailures = discouragedPairChecks(system)
    .filter((check) => !check.pass)
    .map(
      (check) =>
        `- **INTERDIT ${check.foreground}/${check.background} : ${check.ratio}:1**, sous ${check.target}:1 — ${check.reason}`,
    );
  const criticalSummary =
    criticalFailures.length > 0
      ? criticalFailures
      : [
          "- Aucun échec dans les associations sémantiques principales mesurées. Cela ne constitue pas une conformité WCAG globale.",
        ];
  return [...criticalSummary, ...forbiddenFailures].join("\n");
}

function colorVisionSummary(system: ColorSystem): string {
  const lines = THEME_NAMES.flatMap((themeName) =>
    system.colorVision[themeName].map((audit) => {
      const risks =
        audit.riskyPairs.length === 0
          ? "aucune paire sous le seuil de présélection"
          : `paires à renforcer par forme/libellé : ${audit.riskyPairs
              .map((pair) => `${pair.first}-${pair.second}`)
              .join(", ")}`;
      return `- **${themeName}/${audit.deficiency}** — distance minimale OKLab ${audit.minimumDistance}; ${risks}.`;
    }),
  );
  return lines.join("\n");
}

function proposalMarkdown(system: ColorSystem): string {
  const definition = system.definition;
  const status =
    definition.slug === "convergence"
      ? "adoptée et normative. `src/tokens.css` en est la projection de production générée."
      : "exploration non normative. Ces fichiers ne sont jamais importés par les composants de production.";
  return `# ${definition.name}\n\n> ${definition.intention}\n\n**Statut :** ${status}\n\n${definition.description}\n\n## Avantages\n\n${definition.advantages.map((item) => `- ${item}`).join("\n")}\n\n## Risques\n\n${definition.risks.map((item) => `- ${item}`).join("\n")}\n\n## Associations culturelles possibles\n\n${definition.culturalAssociations.map((item) => `- ${item}`).join("\n")}\n\n## Associations interdites ou déconseillées\n\n${definition.forbiddenAssociations.map((item) => `- ${item}`).join("\n")}\n\n## Échelles primitives\n\nLes valeurs OKLCH sont les valeurs de conception après gamut mapping sRGB honnête. HEX/RGB sont les replis calculés. Les canaux alpha existent en versions destinées aux surfaces claires et sombres ; aucun alpha critique n’est utilisé dans les rôles d’action, de focus, de texte ou de statut.\n\n${scaleTables(system)}\n\n## Thèmes et tokens sémantiques\n\n${semanticTables(system)}\n\n## États et composants\n\nLes rôles \`state-hover\`, \`state-active\`, \`state-selected\`, \`state-disabled-*\` et \`state-focus\` restent sémantiques. Le groupe \`component\` du fichier DTCG mappe ensuite boutons, terminal et diff Git vers ces rôles ou vers des primitives documentées. \`action-secondary\` reste neutre et structure un bouton outline ; \`brand-secondary\` porte la couleur secondaire rare sans créer deux CTA concurrents. Les statuts conservent texte, icône et structure ; la couleur n’est jamais l’unique signal.\n\n## Code, terminal et diffs Git\n\n- Le code possède des rôles distincts pour fond, texte, commentaire, mot-clé, chaîne, nombre, fonction, variable, opérateur, bord et ligne active.\n- Les diffs ont pour chaque état un fond, un texte et une bordure ; les signes \`+\`, \`~\`, \`−\` et les libellés restent obligatoires.\n- Le terminal utilise un fond opaque, un texte principal et des canaux prompt/commande/succès/attention/erreur/information mesurés.\n\n## Visualisation de données\n\n${visualizationTables(system)}\n\nLes catégories doivent toujours être doublées par labels, formes, motifs ou styles de ligne. Les rampes séquentielles ne codent qu’une grandeur ordonnée ; la rampe divergente exige un point médian explicitement nommé.\n\n## Contrastes calculés\n\n${contrastTables(system)}\n\n## Échecs WCAG explicitement détectés\n\n${explicitFailureSummary(system)}\n\n\`border-subtle\` est réservé aux séparateurs non essentiels et n’est jamais accepté comme seule frontière d’un contrôle. Les contrôles utilisent \`border-default\`.\n\n## Présélection daltonisme\n\n${colorVisionSummary(system)}\n\nCette simulation est un filtre de conception, pas un test clinique.\n\n## Aperçus fournis\n\nLe fichier [preview.html](./preview.html) applique la proposition à :\n\n1. une page d’accueil ;\n2. une documentation technique ;\n3. une interface de gestion d’agents ;\n4. un terminal/journal d’exécution ;\n5. une page de repository de type GitHub ;\n6. un diagramme d’architecture.\n\n## Notes\n\n- [theme.css](./theme.css) : primitives, thèmes, forced-colors et composants ;\n- [tokens.json](./tokens.json) : format DTCG 2025.10 ;\n- [tailwind.css](./tailwind.css) : configuration CSS-first Tailwind 4.3 avec \`@theme inline\` ;\n- [audit.json](./audit.json) : mesures et limites machine-lisibles.\n\n## Évaluation\n\n| Critère | Note |\n| --- | ---: |\n${scoreTable(definition)}\n| **Moyenne** | **${scoreAverage(definition).toFixed(2)}/10** |\n`;
}

function previewStyles(): string {
  return `
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--lai-color-text-primary); background: var(--lai-color-background); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }
    button, input { font: inherit; }
    button:focus-visible, a:focus-visible { outline: 3px solid var(--lai-color-focus-ring); outline-offset: 3px; }
    .shell { width: min(1180px, calc(100% - 32px)); margin: auto; padding: 24px 0 80px; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; border: 1px solid var(--lai-color-border-default); background: var(--lai-color-surface-overlay); }
    .toolbar button, .button { min-height: 44px; padding: 10px 16px; border: 2px solid var(--lai-color-border-default); border-radius: 8px; color: var(--lai-color-text-primary); background: var(--lai-color-surface); cursor: pointer; }
    .button.primary { color: var(--lai-color-text-inverse); border-color: var(--lai-color-action-primary); background: var(--lai-color-action-primary); }
    .button.primary:hover { background: var(--lai-color-action-primary-hover); }
    .eyebrow { color: var(--lai-color-brand-secondary); font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
    .muted { color: var(--lai-color-text-muted); }
    .surface { padding: 24px; border: 1px solid var(--lai-color-border-default); border-radius: 12px; background: var(--lai-color-surface); }
    .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    section { margin-top: 40px; }
    .hero { padding: clamp(32px, 8vw, 96px) 0; }
    .hero h1 { max-width: 14ch; margin: 8px 0; font-size: clamp(40px, 7vw, 76px); line-height: 1; }
    .trail { display: flex; gap: 8px; align-items: center; margin: 24px 0; color: var(--lai-color-action-primary); }
    .trail span { width: 12px; height: 12px; background: currentColor; }
    .trail span:nth-child(2) { width: 9px; height: 9px; opacity: .75; }
    .trail span:nth-child(3) { width: 6px; height: 6px; opacity: .5; }
    .docs { display: grid; grid-template-columns: minmax(160px, .3fr) 1fr; gap: 16px; }
    nav a { display: block; min-height: 44px; padding: 10px; color: var(--lai-color-text-secondary); }
    nav a[aria-current] { color: var(--lai-color-text-primary); border-inline-start: 4px solid var(--lai-color-action-primary); background: var(--lai-color-state-selected); }
    pre { overflow: auto; padding: 20px; border: 1px solid var(--lai-color-code-border); color: var(--lai-color-code-text); background: var(--lai-color-code-background); }
    .kw { color: var(--lai-color-code-keyword); } .str { color: var(--lai-color-code-string); } .fn { color: var(--lai-color-code-function); } .cm { color: var(--lai-color-code-comment); }
    .agents { display: grid; gap: 8px; }
    .agent { display: grid; grid-template-columns: 1fr auto auto; gap: 12px; align-items: center; padding: 14px; border: 1px solid var(--lai-color-border-default); background: var(--lai-color-surface-subtle); }
    .status { display: inline-flex; gap: 8px; align-items: center; font-weight: 700; }
    .status::before { width: 12px; height: 12px; border: 2px solid currentColor; border-radius: 50%; content: ""; }
    .success { color: var(--lai-color-success); } .warning { color: var(--lai-color-warning); } .danger { color: var(--lai-color-danger); } .info { color: var(--lai-color-info); }
    .terminal { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; color: var(--lai-component-terminal-text); background: var(--lai-component-terminal-background); }
    .terminal p { margin: 6px 0; } .prompt { color: var(--lai-component-terminal-prompt); } .command { color: var(--lai-component-terminal-command); } .dim { color: var(--lai-component-terminal-dim); }
    .diff { overflow: hidden; padding: 0; }
    .diff-line { display: grid; grid-template-columns: 40px 1fr; padding: 8px 12px; font-family: ui-monospace, monospace; }
    .added { color: var(--lai-component-diff-added-text); border-inline-start: 4px solid var(--lai-component-diff-added-border); background: var(--lai-component-diff-added-background); }
    .modified { color: var(--lai-component-diff-modified-text); border-inline-start: 4px solid var(--lai-component-diff-modified-border); background: var(--lai-component-diff-modified-background); }
    .removed { color: var(--lai-component-diff-removed-text); border-inline-start: 4px solid var(--lai-component-diff-removed-border); background: var(--lai-component-diff-removed-background); }
    .diagram { width: 100%; min-height: 360px; color: var(--lai-color-text-primary); }
    .diagram .node { fill: var(--lai-color-surface); stroke: var(--lai-color-border-strong); stroke-width: 3; }
    .diagram .active { stroke: var(--lai-color-action-primary); stroke-width: 5; }
    .diagram .edge { fill: none; stroke: var(--lai-color-text-secondary); stroke-width: 3; }
    .diagram .evidence { fill: none; stroke: var(--lai-color-action-secondary); stroke-width: 3; stroke-dasharray: 8 6; }
    .diagram text { fill: var(--lai-color-text-primary); font: 700 16px ui-sans-serif, system-ui; }
    .data { display: flex; gap: 8px; align-items: end; min-height: 180px; }
    .data-item { display: flex; flex: 1; min-width: 32px; flex-direction: column; gap: 6px; justify-content: end; text-align: center; }
    .data-bar { height: var(--bar-height); border: 3px var(--bar-border) var(--lai-color-border-strong); background: var(--bar-color); }
    @media (max-width: 700px) { .docs { grid-template-columns: 1fr; } .agent { grid-template-columns: 1fr; } }
    @media (forced-colors: active) { .status::before { forced-color-adjust: auto; } }
  `;
}

function generatePreview(system: ColorSystem, css: string): string {
  const borderStyles = ["solid", "dashed", "dotted", "double"] as const;
  const bars = system.visualization.light.categories
    .map(
      (_, index) =>
        `<div class="data-item"><span class="data-bar" aria-hidden="true" style="--bar-height:${45 + ((index * 31) % 85)}px;--bar-color:var(--lai-data-category-${index + 1});--bar-border:${borderStyles[index % borderStyles.length]}"></span><small>Série ${index + 1}</small></div>`,
    )
    .join("");
  return `<!doctype html>
<html lang="fr" data-lai-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${system.definition.name} — aperçu Libre AI</title>
  <style>${css}\n${previewStyles()}</style>
</head>
<body>
  <div class="shell">
    <header class="toolbar" aria-label="Choix du thème">
      <strong>${system.definition.name}</strong>
      <button type="button" data-theme="light">Clair</button>
      <button type="button" data-theme="dark">Sombre</button>
      <button type="button" data-theme="dark-high-contrast">Contraste renforcé</button>
    </header>
    <main>
      <section class="hero" aria-labelledby="home-title">
        <p class="eyebrow">Communs numériques · ingénierie ouverte</p>
        <h1 id="home-title">Construire des systèmes que chacun peut comprendre et reconstruire.</h1>
        <p class="muted">Outils, contrats et preuves pour agir avec des agents IA sans dépendre de la magie.</p>
        <div class="trail" aria-label="Trace vérifiable"><span></span><span></span><span></span><strong>source → décision → preuve</strong></div>
        <button class="button primary" type="button">Explorer les communs</button>
      </section>

      <section aria-labelledby="docs-title"><h2 id="docs-title">Documentation technique</h2>
        <div class="docs"><nav class="surface" aria-label="Documentation"><a href="#">Introduction</a><a href="#" aria-current="page">Contrat d’exécution</a><a href="#">Vérification</a></nav>
        <article class="surface"><p class="eyebrow">Contrat</p><h3>Une autorisation explicite précède toute exécution</h3><p class="muted">Les refus sont stables, documentés et vérifiables.</p><pre><code><span class="kw">export function</span> <span class="fn">authorize</span>(mission) {
  <span class="cm">// Refuser plutôt qu’inventer une autorité.</span>
  <span class="kw">return</span> mission.proof ? <span class="str">"authorized"</span> : <span class="str">"denied"</span>;
}</code></pre></article></div>
      </section>

      <section aria-labelledby="agents-title"><h2 id="agents-title">Gestion des agents</h2><div class="surface agents">
        <div class="agent"><strong>Inspection contrats</strong><span class="status success">Terminé</span><button class="button">Preuve</button></div>
        <div class="agent"><strong>Revue dépendances</strong><span class="status warning">Décision requise</span><button class="button primary">Examiner</button></div>
        <div class="agent"><strong>Publication</strong><span class="status danger">Refusée</span><button class="button">Diagnostic</button></div>
      </div></section>

      <section aria-labelledby="terminal-title"><h2 id="terminal-title">Terminal et journal d’exécution</h2><div class="surface terminal">
        <p><span class="prompt">libre-ai ›</span> <span class="command">verify --scope contracts</span></p>
        <p class="dim">[12:41:03] 85 autorités chargées</p>
        <p style="color:var(--lai-component-terminal-success)">✓ schémas et digests vérifiés</p>
        <p style="color:var(--lai-component-terminal-warning)">! décision humaine conservée</p>
        <p style="color:var(--lai-component-terminal-error)">× publication refusée sans preuve</p>
      </div></section>

      <section aria-labelledby="repo-title"><h2 id="repo-title">Page de repository</h2><div class="surface grid"><article><p class="eyebrow">libre-ai / proof</p><h3>Preuves reproductibles</h3><p class="muted">Apache-2.0 · build vérifié · zéro ressource distante</p><button class="button primary">Lire la documentation</button></article>
        <div class="surface diff" aria-label="Diff Git"><div class="diff-line added"><strong>+</strong><span>signature vérifiée</span></div><div class="diff-line modified"><strong>~</strong><span>limite explicitée</span></div><div class="diff-line removed"><strong>−</strong><span>affirmation non sourcée</span></div></div></div>
      </section>

      <section aria-labelledby="diagram-title"><h2 id="diagram-title">Diagramme d’architecture</h2><div class="surface"><svg class="diagram" viewBox="0 0 900 360" role="img" aria-labelledby="svg-title svg-desc"><title id="svg-title">Architecture Libre AI</title><desc id="svg-desc">Une application consomme des contrats, un orchestrateur borné et des preuves vérifiables.</desc>
        <path class="edge" d="M210 90H350M550 90H690M450 140V240"/><path class="evidence" d="M210 290H350M550 290H690"/>
        <rect class="node" x="30" y="40" width="180" height="100" rx="12"/><rect class="node active" x="350" y="40" width="200" height="100" rx="12"/><rect class="node" x="690" y="40" width="180" height="100" rx="12"/><rect class="node" x="350" y="240" width="200" height="100" rx="12"/>
        <text x="120" y="96" text-anchor="middle">Application</text><text x="450" y="96" text-anchor="middle">Contrats</text><text x="780" y="96" text-anchor="middle">Orchestrateur</text><text x="450" y="296" text-anchor="middle">Preuves</text></svg></div>
      </section>

      <section aria-labelledby="data-title"><h2 id="data-title">Visualisation catégorielle</h2><div class="surface"><div class="data" role="img" aria-label="Huit séries nommées, distinguées par couleur, hauteur et style de bordure">${bars}</div><p class="muted">La hauteur, les labels et les styles de bordure doublent la couleur.</p></div></section>
    </main>
  </div>
  <script>
    document.querySelectorAll("[data-theme]").forEach((button) => {
      button.addEventListener("click", () => {
        document.documentElement.dataset.laiTheme = button.dataset.theme;
      });
    });
  </script>
</body>
</html>\n`;
}

function masterReadme(systems: readonly ColorSystem[]): string {
  const proposals = systems.filter((system) => system.definition.slug !== "convergence");
  const convergence = systems.find((system) => system.definition.slug === "convergence");
  if (convergence === undefined) throw new Error("color.convergence_missing");
  const ranking = [...proposals].sort(
    (first, second) => scoreAverage(second.definition) - scoreAverage(first.definition),
  );
  const scoreRows = SCORE_CRITERIA.map(
    (criterion) =>
      `| ${SCORE_LABELS[criterion]} | ${proposals.map((system) => system.definition.scores[criterion]).join(" | ")} |`,
  ).join("\n");
  const averageRow = `| **Moyenne** | ${proposals.map((system) => `**${scoreAverage(system.definition).toFixed(2)}**`).join(" | ")} |`;
  return `# Exploration du système de couleurs Libre AI\n\n**Statut : exploration non normative — décision humaine requise avant adoption.**\n\nCette exploration sépare strictement :\n\n1. les primitives OKLCH et leurs replis sRGB ;\n2. les rôles sémantiques indépendants des noms de couleur ;\n3. les tokens de composants ;\n4. les projections CSS, DTCG et Tailwind 4.3.\n\nAucune proposition ne modifie les tokens de production de \`packages/ui/src/styles.css\`.\n\n## Propositions\n\n${proposals.map((system) => `- [${system.definition.name}](./${system.definition.slug}/README.md) — ${system.definition.intention}`).join("\n")}\n\n## Méthode\n\n- OKLCH est l’espace de conception ; chaque couleur hors gamut est ramenée honnêtement par réduction de chroma, sans modifier artificiellement sa luminosité pour annoncer une conformité.\n- Toutes les valeurs sont exportées en OKLCH, HEX et RGB.\n- Les couleurs alpha existent pour surfaces claires et sombres mais ne portent aucun élément critique.\n- Les ratios WCAG 2.2 sont calculés sur les replis sRGB opaques.\n- Les modes sombre et contraste renforcé remappent les rôles, jamais les composants.\n- Les tests daltonisme sont une présélection matricielle ; labels, formes, motifs et styles de ligne restent obligatoires.\n- Les mécanismes étudiés reprennent les principes de systèmes reconnus, jamais leurs valeurs ni leur apparence.\n- Budget visuel de revue : 85–92 % de surfaces neutres, 5–10 % de primaire, 1–4 % de secondaire ; ce n’est pas un quota CSS.\n- La couleur secondaire de marque n’est jamais le bouton secondaire : celui-ci reste neutre et structurel.\n\n## Tableau comparatif\n\n| Critère | ${proposals.map((system) => system.definition.name).join(" | ")} |\n| --- | ${proposals.map(() => "---:").join(" | ")} |\n${scoreRows}\n${averageRow}\n\n## Classement argumenté\n\n${ranking
    .map((system, index) => {
      const rationale =
        system.definition.slug === "libre-tech"
          ? "meilleur équilibre entre singularité, documentation, accessibilité et stabilité"
          : system.definition.slug === "atelier-libre"
            ? "identité la plus distinctive et la plus actionnable, avec un risque hacker à surveiller"
            : system.definition.slug === "infrastructure-europeenne"
              ? "meilleure rigueur opérationnelle, mais apparence plus B2B et institutionnelle"
              : "meilleure chaleur publique et communautaire, mais complexité et proximité du violet IA";
      return `${index + 1}. **${system.definition.name} — ${scoreAverage(system.definition).toFixed(2)}/10 :** ${rationale}.`;
    })
    .join(
      "\n",
    )}\n\nLes notes sont une aide à la décision, pas une vérité de marque. Elles doivent être confrontées aux prototypes et aux publics.\n\n## Éléments combinables\n\n- **Libre Tech :** graphite chaud, discipline éditoriale et iris minéral.\n- **Atelier libre :** jade outil, langage de construction et capacité d’action.\n- **Infrastructure européenne :** cartographie des surfaces sombres et contraste renforcé.\n- **Commun vivant :** chaleur des contenus publics et usage extrêmement rare du corail, hors statuts critiques.\n\nNe pas combiner les palettes en additionnant leurs couleurs. La convergence retient un rôle précis de chaque direction.\n\n## Palette de convergence\n\n[${convergence.definition.name}](./convergence/README.md) combine le graphite chaud de Libre Tech, le jade constructif d’Atelier libre et un iris ardoise secondaire. Le cobalt/turquoise et le corail ne deviennent pas des accents de marque : ils restent disponibles dans les familles fonctionnelles information/danger ou dans la visualisation avec redondance.\n\n## Décisions nécessitant encore un arbitrage humain\n\n1. Le **jade** doit-il rester la couleur principale de continuité ou l’**iris** devenir le signe distinctif principal ?\n2. Jusqu’où réchauffer le graphite sans donner une tonalité éditoriale patrimoniale ?\n3. Les produits reçoivent-ils une secondaire stable ou une sélection contextuelle issue de la palette catégorielle ?\n4. Le corail est-il autorisé dans la communication communautaire alors qu’il jouxte la famille danger ?\n5. Le mode sombre standard doit-il être plus doux que le terminal, ou partager exactement son fond ?\n6. Quelle reproduction CMJN/PDF-X est acceptée pour les supports imprimés ?\n\n## Prototypes et tests avant adoption\n\n- Test de reconnaissance sans logo : page d’accueil, documentation et agent board mélangés à des références concurrentes.\n- Test de compréhension des états avec achromatopsie simulée et sans légende couleur.\n- Parcours clavier/lecteur d’écran et forced-colors sur les composants réels.\n- Comparaison sur appareils LCD/OLED, luminosité basse et forte lumière ambiante.\n- Revue des six aperçus avec contributeurs techniques, publics non techniques et mainteneurs.\n- Test de 8 séries catégorielles sous protanopie, deutéranopie et tritanopie ; réduire à 6 catégories si les formes ne suffisent pas.\n- Épreuve papier réelle avant toute promesse print.\n- Test longitudinal : reconnaître la direction après retrait des effets, illustrations et motion.\n\n## Limites de conformité\n\nLes audits couvrent les associations de tokens listées. Ils ne constituent ni certification WCAG globale, ni validation d’un composant, ni preuve de lisibilité d’une page complète. Les aperçus doivent être remplacés par des tests multi-moteurs après adoption dans les composants.\n\n## Tailwind CSS\n\nChaque proposition fournit un fichier \`tailwind.css\` CSS-first pour Tailwind 4.3. Il importe le thème puis expose uniquement les rôles sémantiques via \`@theme inline\`. Les primitives ne deviennent donc pas des utilitaires de composants. Cette syntaxe suit la documentation officielle \`/tailwindlabs/tailwindcss.com\`.\n`;
}

function adoptedMasterReadme(systems: readonly ColorSystem[]): string {
  const pendingDecisions = `## Décisions nécessitant encore un arbitrage humain

1. Le **jade** doit-il rester la couleur principale de continuité ou l’**iris** devenir le signe distinctif principal ?
2. Jusqu’où réchauffer le graphite sans donner une tonalité éditoriale patrimoniale ?
3. Les produits reçoivent-ils une secondaire stable ou une sélection contextuelle issue de la palette catégorielle ?
4. Le corail est-il autorisé dans la communication communautaire alors qu’il jouxte la famille danger ?
5. Le mode sombre standard doit-il être plus doux que le terminal, ou partager exactement son fond ?
6. Quelle reproduction CMJN/PDF-X est acceptée pour les supports imprimés ?`;
  const adoptedDecisions = `## Décisions d’adoption

1. Le **jade** porte la marque et l’action primaire ; l’**iris** reste une différenciation secondaire rare.
2. Le graphite chaud porte les surfaces claires et sombres sans noir absolu.
3. Les produits ne reçoivent aucune couleur permanente assimilable à un état.
4. Les familles corail, ambre, vert et bleu restent fonctionnelles.
5. Jade et iris ne forment jamais un dégradé.
6. La reproduction CMJN/PDF-X reste hors de la preuve numérique actuelle et exige une qualification physique séparée.`;

  return masterReadme(systems)
    .replace("# Exploration du système de couleurs Libre AI", "# Système de couleurs Libre AI")
    .replace(
      "**Statut : exploration non normative — décision humaine requise avant adoption.**",
      "**Statut : Envol constructif est adopté ; les quatre directions initiales restent des explorations non normatives.**",
    )
    .replace("Cette exploration sépare strictement :", "Ce système sépare strictement :")
    .replace(
      "Aucune proposition ne modifie les tokens de production de `packages/ui/src/styles.css`.",
      "Seule la convergence Envol constructif génère les tokens de production dans `src/tokens.css`. Les quatre explorations ne sont jamais importées par les composants.",
    )
    .replace(pendingDecisions, adoptedDecisions)
    .replace("## Prototypes et tests avant adoption", "## Qualification après adoption");
}

async function buildFiles(): Promise<readonly GeneratedFile[]> {
  const systems = [...PALETTES, CONVERGENCE].map(buildColorSystem);
  const files: GeneratedFile[] = [{ path: "README.md", content: adoptedMasterReadme(systems) }];
  for (const system of systems) {
    const directory = system.definition.slug;
    const css = generateCss(system);
    files.push(
      { path: `${directory}/README.md`, content: proposalMarkdown(system) },
      { path: `${directory}/tokens.json`, content: generateDtcgTokens(system) },
      { path: `${directory}/theme.css`, content: css },
      { path: `${directory}/tailwind.css`, content: generateTailwindCss() },
      { path: `${directory}/audit.json`, content: contrastAuditJson(system) },
      { path: `${directory}/preview.html`, content: generatePreview(system, css) },
    );
  }
  return files;
}

async function listGeneratedFiles(directory: string): Promise<string[]> {
  const results: string[] = [];
  async function visit(current: string, relative: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true, encoding: "utf8" }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    for (const entry of entries) {
      const childRelative = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const child = join(current, entry.name);
      if (entry.isDirectory()) await visit(child, childRelative);
      else if (entry.isFile()) results.push(childRelative);
    }
  }
  await visit(directory, "");
  return results.sort();
}

async function main(): Promise<void> {
  const files = await buildFiles();
  if (CHECK_MODE) {
    const expectedPaths = files.map((file) => file.path).sort();
    const actualPaths = await listGeneratedFiles(OUTPUT_DIRECTORY);
    if (JSON.stringify(expectedPaths) !== JSON.stringify(actualPaths)) {
      throw new Error("color.generated_file_set_drift");
    }
    for (const file of files) {
      const actual = await Bun.file(join(OUTPUT_DIRECTORY, file.path)).text();
      if (actual !== file.content) throw new Error(`color.generated_content_drift:${file.path}`);
    }
    console.log(`Color system generation verified (${files.length} files)`);
    return;
  }

  for (const file of files) {
    const destination = join(OUTPUT_DIRECTORY, file.path);
    await mkdir(join(destination, ".."), { recursive: true });
    await Bun.write(destination, file.content);
  }
  console.log(`Color system generated (${files.length} files)`);
}

if (import.meta.main) {
  await main();
}
