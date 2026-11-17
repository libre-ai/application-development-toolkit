import { describe, expect, test } from "bun:test";
import { liveRoute, readyRoute } from "./probes";
import { createRequestHandler, type RouteHandler } from "./server";

async function probe(route: RouteHandler): Promise<Response> {
  return createRequestHandler({
    requestId: () => "req_0000000000000001",
    routes: { "/probe": route },
  })(new Request("http://local/probe"));
}

describe("probes", () => {
  test("liveness answers 200 ok with hardened, uncached headers", async () => {
    const response = await probe(liveRoute());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(await response.json()).toEqual({ status: "ok" });
  });

  test("readiness answers 200 ready when the check resolves", async () => {
    const response = await probe(readyRoute(async () => {}));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
  });

  test("readiness answers 503 not_ready, without detail, when the check rejects or throws", async () => {
    const failing: ReadonlyArray<() => void | Promise<void>> = [
      async () => {
        throw new Error("detail prive");
      },
      () => {
        throw new Error("detail prive");
      },
    ];
    for (const check of failing) {
      const response = await probe(readyRoute(check));
      expect(response.status).toBe(503);
      expect(JSON.stringify([...response.headers])).not.toContain("detail prive");
      const text = await response.text();
      expect(text).not.toContain("detail prive");
      expect(JSON.parse(text)).toEqual({ status: "not_ready" });
    }
  });
});
