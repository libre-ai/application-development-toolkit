import { describe, expect, test } from "bun:test";
import { loadCanonicalContractRegistry } from "@libre-ai/contracts";
import { renderStaticDocument } from "@libre-ai/web-platform";
import { referenceDocument } from "../shared/document";
import { createTemplateHandler } from "./handler";

describe("canonical Bun application template", () => {
  test("serves SSR and the bounded JSON route", async () => {
    const handler = createTemplateHandler(
      "/nonexistent-build-output",
      () => "req_0000000000000001",
    );
    const htmlResponse = await handler(new Request("http://local/"));
    const html = await htmlResponse.text();
    expect(htmlResponse.status).toBe(200);
    expect(html).toContain("Bun direct, React accessible");
    expect(html).toContain("Version statique");

    const health = await handler(new Request("http://local/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      service: "libre-ai-bun-reference",
      status: "ok",
      version: "v1",
    });

    const missing = await handler(new Request("http://local/missing"));
    const problem = await missing.json();
    const contracts = await loadCanonicalContractRegistry();
    expect(contracts.validate("problem-details.v1.schema.json", problem).ok).toBeTrue();
  });

  test("generates byte-identical useful no-JavaScript HTML", () => {
    const first = renderStaticDocument(referenceDocument());
    const second = renderStaticDocument(referenceDocument());
    expect(first).toEqual(second);
    const html = new TextDecoder().decode(first);
    expect(html).toContain("<noscript>");
    expect(html).toContain('href="/api/health"');
    expect(html).not.toContain("https://");
  });
});
