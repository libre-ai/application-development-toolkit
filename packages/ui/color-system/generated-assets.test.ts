import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import Ajv from "ajv";
import { compile } from "tailwindcss";
import { PALETTES } from "./palettes";
import { EXTENDED_SEMANTIC_ROLES, REQUIRED_SEMANTIC_ROLES } from "./system";

const GENERATED_DIRECTORY = join(import.meta.dir, "generated");
const PROPOSAL_SLUGS = [...PALETTES.map((palette) => palette.slug), "convergence"];

interface AuditReport {
  failures: readonly unknown[];
  discouragedPairs: readonly { pass: boolean }[];
  componentContrast: Record<string, readonly { pass: boolean }[]>;
  colorVisionWarnings: readonly unknown[];
}

describe("generated color-system deliverables", () => {
  test("marks only Envol constructif as adopted and normative", async () => {
    const convergence = await Bun.file(
      join(GENERATED_DIRECTORY, "convergence", "tokens.json"),
    ).json();
    expect(convergence.$extensions.libreAI.status).toBe("adopted");
    expect(convergence.$extensions.libreAI.normative).toBe(true);
    const convergenceReadme = await Bun.file(
      join(GENERATED_DIRECTORY, "convergence", "README.md"),
    ).text();
    expect(convergenceReadme).toContain("**Statut :** adoptée et normative.");
    const indexReadme = await Bun.file(join(GENERATED_DIRECTORY, "README.md")).text();
    expect(indexReadme).toContain("Envol constructif est adopté");
    expect(indexReadme).toContain("## Décisions d’adoption");
    expect(indexReadme).not.toContain("## Décisions nécessitant encore un arbitrage humain");

    for (const slug of PALETTES.map(({ slug }) => slug)) {
      const exploration = await Bun.file(join(GENERATED_DIRECTORY, slug, "tokens.json")).json();
      expect(exploration.$extensions.libreAI.status).toBe("exploration");
      expect(exploration.$extensions.libreAI.normative).toBe(false);
    }
  });

  test("emits complete DTCG 2025.10 token files", async () => {
    const schema = await Bun.file(
      join(
        import.meta.dir,
        "..",
        "third_party",
        "dtcg-format-2025.10",
        "dtcg-format-2025.10.schema.json",
      ),
    ).json();
    const validateDtcg = new Ajv({
      allErrors: true,
      strict: false,
      validateFormats: false,
    }).compile(schema);
    for (const slug of PROPOSAL_SLUGS) {
      const tokens = await Bun.file(join(GENERATED_DIRECTORY, slug, "tokens.json")).json();
      expect(validateDtcg(tokens)).toBe(true);
      expect(validateDtcg.errors).toBeNull();
      expect(tokens.$schema).toBe("https://www.designtokens.org/schemas/2025.10/format.json");
      expect(Object.keys(tokens.primitive)).toEqual([
        "neutral",
        "primary",
        "secondary",
        "red",
        "amber",
        "green",
        "blue",
      ]);
      for (const family of Object.values(tokens.primitive) as Array<{
        solid: Record<string, { $value?: Record<string, unknown> }>;
        alpha: {
          onLight: Record<string, { $value?: Record<string, unknown> }>;
          onDark: Record<string, { $value?: Record<string, unknown> }>;
        };
      }>) {
        expect(Object.keys(family.solid).filter((key) => !key.startsWith("$"))).toHaveLength(12);
        expect(
          Object.keys(family.alpha.onLight).filter((key) => !key.startsWith("$")),
        ).toHaveLength(12);
        expect(Object.keys(family.alpha.onDark).filter((key) => !key.startsWith("$"))).toHaveLength(
          12,
        );
        for (const collection of [family.solid, family.alpha.onLight, family.alpha.onDark]) {
          for (const [key, token] of Object.entries(collection)) {
            if (key.startsWith("$") || token.$value === undefined) continue;
            expect(Object.keys(token.$value)).toEqual(["colorSpace", "components", "alpha"]);
          }
        }
      }
      for (const theme of ["light", "dark", "dark-high-contrast"] as const) {
        for (const role of [...REQUIRED_SEMANTIC_ROLES, ...EXTENDED_SEMANTIC_ROLES]) {
          expect(tokens.semantic[theme][role].$value).toMatch(/^\{primitive\./);
        }
        expect(tokens.component[theme]["button-primary-background"].$value).toBe(
          `{semantic.${theme}.action-primary}`,
        );
        expect(tokens.component[theme]["diff-added-background"].$value).toBe(
          `{semantic.${theme}.code-added}`,
        );
      }
    }
  });

  test("records critical contrast success and prohibited primitive failures honestly", async () => {
    for (const slug of PROPOSAL_SLUGS) {
      const audit = (await Bun.file(
        join(GENERATED_DIRECTORY, slug, "audit.json"),
      ).json()) as AuditReport;
      expect(audit.failures).toEqual([]);
      expect(audit.colorVisionWarnings).toEqual([]);
      for (const checks of Object.values(audit.componentContrast)) {
        expect(checks).toHaveLength(22);
        expect(checks.every((check) => check.pass)).toBe(true);
      }
      expect(audit.discouragedPairs.some((check) => !check.pass)).toBe(true);
    }
  });

  test("compiles each Tailwind CSS 4.3 semantic configuration", async () => {
    for (const slug of PROPOSAL_SLUGS) {
      const theme = await Bun.file(join(GENERATED_DIRECTORY, slug, "theme.css")).text();
      const tailwind = await Bun.file(join(GENERATED_DIRECTORY, slug, "tailwind.css")).text();
      expect(theme).toContain("@supports (color: oklch(0 0 0))");
      expect(theme).toContain("@media (forced-colors: active)");
      expect(theme).toMatch(/--lai-color-background: #[0-9a-f]{6};/);
      expect(theme).toMatch(/--lai-color-background: oklch\(/);
      expect(theme).toContain(
        "--lai-component-button-primary-background: var(--lai-color-action-primary);",
      );
      const source = `${theme}\n${tailwind.replace('@import "./theme.css";', "")}`;
      const compiler = await compile(source);
      const output = compiler.build([
        "bg-background",
        "text-text-primary",
        "border-border-default",
        "outline-focus-ring",
      ]);
      expect(output).toContain(".bg-background");
      expect(output).toContain(".text-text-primary");
      expect(output).toContain(".border-border-default");
      expect(output).toContain(".outline-focus-ring");
    }
  });

  test("keeps previews local, explicit and free from generic AI effects", async () => {
    for (const slug of PROPOSAL_SLUGS) {
      const preview = await Bun.file(join(GENERATED_DIRECTORY, slug, "preview.html")).text();
      expect(preview).not.toMatch(/https?:\/\//);
      expect(preview).not.toContain("linear-gradient");
      expect(preview).not.toContain("radial-gradient");
      expect(preview).not.toContain("filter: blur");
      expect(preview).toContain("Documentation technique");
      expect(preview).toContain("Gestion des agents");
      expect(preview).toContain("Terminal et journal d’exécution");
      expect(preview).toContain("Page de repository");
      expect(preview).toContain("Diagramme d’architecture");
      expect(preview).toContain("Visualisation catégorielle");
    }
  });
});
