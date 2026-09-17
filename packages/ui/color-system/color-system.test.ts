import { describe, expect, test } from "bun:test";
import { contrastRatio, oklchToSrgbChannels, renderColor } from "./color";
import { CONVERGENCE, PALETTES, SCALE_STEPS } from "./palettes";
import {
  buildColorSystem,
  EXTENDED_SEMANTIC_ROLES,
  REQUIRED_SEMANTIC_ROLES,
  resolveColor,
  THEME_NAMES,
} from "./system";

const systems = [...PALETTES, CONVERGENCE].map(buildColorSystem);

describe("OKLCH color system exploration", () => {
  test("converts neutral OKLCH endpoints and computes canonical contrast", () => {
    const white = renderColor({ lightness: 1, chroma: 0, hue: 0 });
    const black = renderColor({ lightness: 0, chroma: 0, hue: 0 });

    expect(white.hex).toBe("#ffffff");
    expect(black.hex).toBe("#000000");
    expect(contrastRatio(white.rgb, black.rgb)).toBeCloseTo(21, 5);
  });

  test("produces complete, monotone, in-gamut 12-step primitive scales", () => {
    for (const system of systems) {
      for (const scale of Object.values(system.primitives)) {
        let previousLightness = Number.POSITIVE_INFINITY;
        for (const step of SCALE_STEPS) {
          const color = scale[step];
          expect(color.solid.oklch.lightness).toBeLessThan(previousLightness);
          expect(color.solid.hex).toMatch(/^#[0-9a-f]{6}$/);
          expect(color.alphaOnLight.hexWithAlpha).toMatch(/^#[0-9a-f]{8}$/);
          expect(color.alphaOnDark.hexWithAlpha).toMatch(/^#[0-9a-f]{8}$/);
          for (const rendered of [color.solid, color.alphaOnLight, color.alphaOnDark]) {
            for (const channel of oklchToSrgbChannels(rendered.oklch)) {
              expect(channel).toBeGreaterThanOrEqual(-1e-7);
              expect(channel).toBeLessThanOrEqual(1 + 1e-7);
            }
          }
          previousLightness = color.solid.oklch.lightness;
        }
      }
    }
  });

  test("maps every required and extended semantic role in every theme", () => {
    for (const system of systems) {
      for (const themeName of THEME_NAMES) {
        const theme = system.semantics[themeName];
        for (const role of [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES]) {
          const resolved = resolveColor(system.primitives, theme[role]);
          expect(resolved.hex).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  test("passes every declared critical contrast association", () => {
    for (const system of systems) {
      for (const themeName of THEME_NAMES) {
        const semanticFailures = system.contrast[themeName].filter((check) => !check.pass);
        const componentFailures = system.componentContrast[themeName].filter(
          (check) => !check.pass,
        );
        expect(semanticFailures).toEqual([]);
        expect(componentFailures).toEqual([]);
      }
    }
  });

  test("keeps categorical marks distinguishable from their surfaces and screened deficiencies", () => {
    for (const system of systems) {
      for (const themeName of THEME_NAMES) {
        const theme = system.semantics[themeName];
        const background = resolveColor(system.primitives, theme.background);
        for (const category of system.visualization[themeName].categories) {
          expect(contrastRatio(category.rgb, background.rgb)).toBeGreaterThanOrEqual(3);
        }
        for (const audit of system.colorVision[themeName]) {
          expect(audit.riskyPairs).toEqual([]);
          expect(audit.minimumDistance).toBeGreaterThanOrEqual(0.055);
        }
      }
    }
  });

  test("keeps terminal and diff text independently readable", () => {
    for (const system of systems) {
      for (const themeName of THEME_NAMES) {
        const components = system.components[themeName];
        const terminalText = resolveColor(system.primitives, components.terminal.text);
        const terminalBackground = resolveColor(system.primitives, components.terminal.background);
        expect(contrastRatio(terminalText.rgb, terminalBackground.rgb)).toBeGreaterThanOrEqual(7);

        const diffPairs = [
          [components.diff.addedText, components.diff.addedBackground],
          [components.diff.modifiedText, components.diff.modifiedBackground],
          [components.diff.removedText, components.diff.removedBackground],
        ] as const;
        for (const [textReference, backgroundReference] of diffPairs) {
          const text = resolveColor(system.primitives, textReference);
          const background = resolveColor(system.primitives, backgroundReference);
          expect(contrastRatio(text.rgb, background.rgb)).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  test("keeps the four directions structurally distinct", () => {
    const signatures = PALETTES.map((palette) =>
      JSON.stringify({
        neutral: palette.families.neutral,
        primary: palette.families.primary,
        secondary: palette.families.secondary,
      }),
    );
    expect(new Set(signatures).size).toBe(PALETTES.length);
  });
});
