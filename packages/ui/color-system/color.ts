export interface OklchColor {
  lightness: number;
  chroma: number;
  hue: number;
  alpha?: number;
}

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export interface RenderedColor {
  oklch: Required<OklchColor>;
  rgb: RgbColor;
  hex: string;
  hexWithAlpha: string;
  css: string;
  rgbCss: string;
}

export type ColorVisionDeficiency = "protanopia" | "deuteranopia" | "tritanopia";

const COLOR_VISION_MATRICES: Record<
  ColorVisionDeficiency,
  readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ]
> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function linearToSrgb(value: number): number {
  if (value <= 0.0031308) return 12.92 * value;
  return 1.055 * value ** (1 / 2.4) - 0.055;
}

function srgbToLinear(value: number): number {
  if (value <= 0.04045) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
}

export function oklchToSrgbChannels(color: OklchColor): readonly [number, number, number] {
  const hueRadians = (color.hue * Math.PI) / 180;
  const a = color.chroma * Math.cos(hueRadians);
  const b = color.chroma * Math.sin(hueRadians);

  const lPrime = color.lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = color.lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = color.lightness - 0.0894841775 * a - 1.291485548 * b;

  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;

  const redLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const greenLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const blueLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [linearToSrgb(redLinear), linearToSrgb(greenLinear), linearToSrgb(blueLinear)];
}

function isInSrgbGamut(channels: readonly number[]): boolean {
  return channels.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1);
}

export function mapOklchToSrgbGamut(color: OklchColor): Required<OklchColor> {
  const normalized: Required<OklchColor> = {
    lightness: clamp(color.lightness),
    chroma: Math.max(0, color.chroma),
    hue: ((color.hue % 360) + 360) % 360,
    alpha: clamp(color.alpha ?? 1),
  };
  if (isInSrgbGamut(oklchToSrgbChannels(normalized))) return normalized;

  let lowerChroma = 0;
  let upperChroma = normalized.chroma;
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const candidateChroma = (lowerChroma + upperChroma) / 2;
    const candidate = { ...normalized, chroma: candidateChroma };
    if (isInSrgbGamut(oklchToSrgbChannels(candidate))) {
      lowerChroma = candidateChroma;
    } else {
      upperChroma = candidateChroma;
    }
  }
  return { ...normalized, chroma: lowerChroma };
}

function byteToHex(value: number): string {
  return Math.round(clamp(value) * 255)
    .toString(16)
    .padStart(2, "0");
}

function formatNumber(value: number, digits = 4): string {
  return Number(value.toFixed(digits)).toString();
}

export function renderColor(input: OklchColor): RenderedColor {
  const oklch = mapOklchToSrgbGamut(input);
  const channels = oklchToSrgbChannels(oklch).map((channel) => clamp(channel)) as [
    number,
    number,
    number,
  ];
  const rgb = {
    red: Math.round(channels[0] * 255),
    green: Math.round(channels[1] * 255),
    blue: Math.round(channels[2] * 255),
  };
  const alphaHex = byteToHex(oklch.alpha);
  const hex = `#${byteToHex(channels[0])}${byteToHex(channels[1])}${byteToHex(channels[2])}`;
  return {
    oklch,
    rgb,
    hex,
    hexWithAlpha: `${hex}${alphaHex}`,
    css: `oklch(${formatNumber(oklch.lightness)} ${formatNumber(oklch.chroma)} ${formatNumber(oklch.hue, 2)}${oklch.alpha < 1 ? ` / ${formatNumber(oklch.alpha)}` : ""})`,
    rgbCss: `rgb(${rgb.red} ${rgb.green} ${rgb.blue}${oklch.alpha < 1 ? ` / ${formatNumber(oklch.alpha)}` : ""})`,
  };
}

export function relativeLuminance(color: RgbColor): number {
  const red = srgbToLinear(color.red / 255);
  const green = srgbToLinear(color.green / 255);
  const blue = srgbToLinear(color.blue / 255);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: RgbColor, second: RgbColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function simulateColorVision(color: RgbColor, deficiency: ColorVisionDeficiency): RgbColor {
  const matrix = COLOR_VISION_MATRICES[deficiency];
  // The screening matrices operate on linear-light RGB; encoded sRGB would distort distances.
  const input = [
    srgbToLinear(color.red / 255),
    srgbToLinear(color.green / 255),
    srgbToLinear(color.blue / 255),
  ] as const;
  const output = matrix.map((row) =>
    linearToSrgb(clamp(row[0] * input[0] + row[1] * input[1] + row[2] * input[2])),
  );
  return {
    red: Math.round((output[0] ?? 0) * 255),
    green: Math.round((output[1] ?? 0) * 255),
    blue: Math.round((output[2] ?? 0) * 255),
  };
}

export function rgbToOklab(color: RgbColor): readonly [number, number, number] {
  const red = srgbToLinear(color.red / 255);
  const green = srgbToLinear(color.green / 255);
  const blue = srgbToLinear(color.blue / 255);

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabDistance(first: RgbColor, second: RgbColor): number {
  const firstLab = rgbToOklab(first);
  const secondLab = rgbToOklab(second);
  return Math.hypot(
    firstLab[0] - secondLab[0],
    firstLab[1] - secondLab[1],
    firstLab[2] - secondLab[2],
  );
}
