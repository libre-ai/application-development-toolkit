import { describe, expect, test } from "bun:test";

import { parseBunPackList, verifyRequiredPackageContents } from "./check-package-contents";

const COMPLETE_PACK_OUTPUT = `bun pack v1.4.0-canary.1

packed 4.46KB package.json
packed 10.28KB LICENSE
packed 1.1KB LICENSES/LicenseRef-Libre-AI-Brand-1.0.txt
packed 0.90KB LICENSING.md
packed 200B src/assets/libre-ai-mark.svg

libre-ai-ui-0.1.0.tgz

Total files: 5
Unpacked size: 16.94KB
`;

describe("npm package contents", () => {
  test("parses only Bun's packed-file records", () => {
    expect(parseBunPackList(COMPLETE_PACK_OUTPUT)).toEqual([
      "package.json",
      "LICENSE",
      "LICENSES/LicenseRef-Libre-AI-Brand-1.0.txt",
      "LICENSING.md",
      "src/assets/libre-ai-mark.svg",
    ]);
  });

  test("rejects output without a real pack list", () => {
    expect(parseBunPackList("bun pack v1.4.0\nTotal files: 0\n")).toEqual([]);
    expect(verifyRequiredPackageContents([])).toEqual(["package.pack_list_empty"]);
  });

  test("rejects truncated or inconsistent Bun pack output", () => {
    expect(parseBunPackList("packed 10.28KB LICENSE\n")).toEqual([]);
    expect(parseBunPackList("packed 10.28KB LICENSE\nTotal files: 2\n")).toEqual([]);
    expect(parseBunPackList("packed 10.28KB LICENSE\nTotal files: 1\nTotal files: 1\n")).toEqual(
      [],
    );
  });

  test("names every required file omitted from the package", () => {
    const complete = parseBunPackList(COMPLETE_PACK_OUTPUT);

    for (const missing of [
      "LICENSE",
      "LICENSING.md",
      "LICENSES/LicenseRef-Libre-AI-Brand-1.0.txt",
      "src/assets/libre-ai-mark.svg",
    ]) {
      expect(verifyRequiredPackageContents(complete.filter((path) => path !== missing))).toEqual([
        `package.required_file_missing:${missing}`,
      ]);
    }
  });

  test("accepts the complete required package surface", () => {
    expect(verifyRequiredPackageContents(parseBunPackList(COMPLETE_PACK_OUTPUT))).toEqual([]);
  });
});
