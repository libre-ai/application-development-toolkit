const MINIMUM_BUN_VERSION = "1.4.0";
const PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function parse(value: string): [number, number, number] | null {
  const match = PATTERN.exec(value);
  if (!match) return null;
  const version: [number, number, number] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return version.every(Number.isSafeInteger) ? version : null;
}

function compare(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftPart = left[index] ?? 0;
    const rightPart = right[index] ?? 0;
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

const actual = parse(Bun.version);
const minimum = parse(MINIMUM_BUN_VERSION);
const supported = actual !== null && minimum !== null && compare(actual, minimum) >= 0;

if (!supported) {
  console.error(
    `Bun ${Bun.version} is unsupported; this application requires Bun >=${MINIMUM_BUN_VERSION}`,
  );
  process.exit(1);
}

console.log(`Bun minimum verified: ${Bun.version} >= ${MINIMUM_BUN_VERSION}`);

// Module marker: keeps this script's top-level consts module-scoped so they
// cannot collide with the identical bun-app template guard under the single
// repo-wide tsconfig (both files are otherwise global scripts).
export {};
