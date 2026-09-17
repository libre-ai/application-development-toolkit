import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const referenceUrl = pathToFileURL(new URL("./reference.html", import.meta.url).pathname).href;

test.beforeEach(async ({ page }) => {
  await page.goto(referenceUrl);
});

test("keeps the canonical promise, identity and evidence visible", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Possédez la fabrique.");
  await expect(page.getByRole("img", { name: "Libre AI", exact: true })).toBeVisible();
  await expect(page.getByText("LIMITE", { exact: true }).first()).toBeVisible();
});

test("loads no remote resource", async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });

  await page.reload();
  await expect(page.locator("body")).toBeVisible();
  expect(remoteRequests).toEqual([]);
});

test("provides a visible keyboard skip path", async ({ page }) => {
  const skipLink = page.getByRole("link", { name: "Aller au contenu" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await skipLink.press("Enter");
  await expect(page.locator("main#content")).toBeVisible();
  expect(page.url().endsWith("#content")).toBe(true);
});

test("reflows at narrow and zoom-equivalent viewports", async ({ page }) => {
  for (const width of [640, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("keeps every part of the 16 px and 24 px marks visible", async ({ page }) => {
  for (const size of [16, 24]) {
    const mark = page.getByRole("img", { name: `${size} pixels`, exact: true });
    await expect(mark).toBeVisible();
    await expect(mark).toHaveCSS("width", `${size}px`);
    await expect(mark).toHaveCSS("height", `${size}px`);

    const parts = mark.locator("path");
    await expect(parts).toHaveCount(3);
    const markBounds = await mark.boundingBox();
    expect(markBounds).not.toBeNull();
    const renderedParts = await parts.evaluateAll((paths) =>
      paths.map((path) => {
        const bounds = (path as SVGGraphicsElement).getBoundingClientRect();
        return {
          fill: getComputedStyle(path).fill,
          height: bounds.height,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        };
      }),
    );

    if (markBounds === null) throw new Error("brand.mark_bounds_missing");
    for (const part of renderedParts) {
      expect(part.width).toBeGreaterThan(0);
      expect(part.height).toBeGreaterThan(0);
      expect(part.fill).not.toBe("none");
      expect(part.fill).not.toBe("rgba(0, 0, 0, 0)");
      expect(part.x).toBeGreaterThanOrEqual(markBounds.x);
      expect(part.y).toBeGreaterThanOrEqual(markBounds.y);
      expect(part.x + part.width).toBeLessThanOrEqual(markBounds.x + markBounds.width);
      expect(part.y + part.height).toBeLessThanOrEqual(markBounds.y + markBounds.height);
    }
  }
});

test("keeps critical computed color pairs distinguishable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-forced-colors", "System colors are OS-defined");

  const colors = await page.evaluate(() => {
    function toSrgb(value: string): [number, number, number] {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("brand.canvas_context_unavailable");
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
      if (red === undefined || green === undefined || blue === undefined) {
        throw new Error("brand.computed_color_unavailable");
      }
      return [red, green, blue];
    }

    const body = getComputedStyle(document.body);
    const button = getComputedStyle(document.querySelector(".lai-button--primary") as HTMLElement);
    return {
      background: toSrgb(body.backgroundColor),
      foreground: toSrgb(body.color),
      buttonBackground: toSrgb(button.backgroundColor),
      buttonForeground: toSrgb(button.color),
    };
  });

  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.buttonForeground, colors.buttonBackground)).toBeGreaterThanOrEqual(4.5);
});

test("captures the Chromium reference for human inspection", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One canonical disposable capture is sufficient");
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("brand-reference.png") });
});

function contrast(
  foreground: readonly [number, number, number],
  background: readonly [number, number, number],
): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(rgb: readonly [number, number, number]): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
