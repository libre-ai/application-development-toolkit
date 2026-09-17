import { createHash } from "node:crypto";
import { join } from "node:path";

import { BRAND_MARK_PARTS, BRAND_MARK_VIEW_BOX } from "../src/brand-geometry";

export function renderBrandMarkSvg(): string {
  const paths = BRAND_MARK_PARTS.map((path) => `  <path d="${path}"/>`).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEW_BOX}" fill="currentColor" aria-hidden="true">\n${paths}\n</svg>\n`;
}

export interface BrandAssetReviewDocuments {
  readonly approval: string;
  readonly candidateMarkSha256: string;
  readonly similarityReview: string;
}

function controlValues(document: string, field: string): readonly string[] {
  const preamble = document.split(/^##\s/m, 1)[0] ?? "";
  const prefix = `${field}:`;
  return preamble
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
}

function hasExactControl(document: string, field: string, expected: string): boolean {
  const values = controlValues(document, field);
  return values.length === 1 && values[0] === expected;
}

function hasExactSha256Control(document: string, field: string, expected: string): boolean {
  return /^[0-9a-f]{64}$/.test(expected) && hasExactControl(document, field, `\`${expected}\``);
}

export function validateBrandAssetPublication(
  documents: BrandAssetReviewDocuments,
): readonly string[] {
  const failures: string[] = [];
  if (!hasExactControl(documents.approval, "License approval", "owner-accepted")) {
    failures.push("brand.asset_license_not_accepted");
  }
  if (
    !hasExactSha256Control(
      documents.approval,
      "- Candidate mark SHA-256",
      documents.candidateMarkSha256,
    )
  ) {
    failures.push("brand.asset_license_candidate_mismatch");
  }
  if (
    !hasExactControl(documents.similarityReview, "Status", "accepted") ||
    !hasExactControl(documents.similarityReview, "Disposition", "owner-accepted")
  ) {
    failures.push("brand.asset_similarity_review_not_accepted");
  }
  if (
    !hasExactSha256Control(documents.similarityReview, "- SHA-256", documents.candidateMarkSha256)
  ) {
    failures.push("brand.asset_similarity_candidate_mismatch");
  }
  return failures;
}

async function main(): Promise<void> {
  const destination = join(import.meta.dir, "../src/assets/libre-ai-mark.svg");
  const expected = renderBrandMarkSvg();

  if (process.argv.includes("--publication-check")) {
    const approval = await Bun.file(
      join(import.meta.dir, "../evidence/BRAND-ASSET-PUBLICATION-APPROVAL.md"),
    ).text();
    const similarityReview = await Bun.file(
      join(import.meta.dir, "../evidence/BRAND-MARK-SIMILARITY-REVIEW.md"),
    ).text();
    const candidateMarkSha256 = createHash("sha256")
      .update(await Bun.file(destination).bytes())
      .digest("hex");
    const failures = validateBrandAssetPublication({
      approval,
      candidateMarkSha256,
      similarityReview,
    });
    if (failures.length > 0) throw new Error(failures.join("\n"));
    console.log("Brand asset publication controls are accepted.");
    return;
  }

  if (process.argv.includes("--check")) {
    const current = await Bun.file(destination).text();
    if (current !== expected) throw new Error("brand.asset_drift");
    console.log("Brand assets are current.");
    return;
  }

  await Bun.write(destination, expected);
  console.log("Generated src/assets/libre-ai-mark.svg.");
}

if (import.meta.main) {
  await main();
}
