import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderSsrDocument, renderStaticDocument } from "./document";
import { createRequestHandler, parseServerAddress } from "./server";

const descriptor = {
  app: createElement("main", { id: "content" }, createElement("h1", null, "Référence")),
  clientModule: "/assets/app.js",
  description: "Template canonique",
  manifest: "/manifest.webmanifest",
  stylesheets: ["/assets/styles.css"],
  title: "Libre AI",
} as const;

describe("canonical web platform", () => {
  test("renders equivalent SSR and deterministic static documents", async () => {
    const first = renderStaticDocument(descriptor);
    const second = renderStaticDocument(descriptor);
    expect(first).toEqual(second);
    expect(new TextDecoder().decode(first)).toStartWith("<!doctype html>");

    const response = await renderSsrDocument(descriptor);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain("Référence");
    expect(html).toContain('src="/assets/app.js"');
    expect(html).toContain("<noscript>");
  });

  test("routes HTML, JSON, assets and HEAD without exposing failures", async () => {
    const handler = createRequestHandler({
      assets: {
        "/asset.txt": { body: "local", contentType: "text/plain" },
      },
      requestId: () => "req_0000000000000001",
      routes: {
        "/": () => renderSsrDocument(descriptor),
        "/api/health": () => Response.json({ status: "ok" }),
        "/failure": () => {
          throw new Error("private detail");
        },
      },
    });

    expect((await handler(new Request("http://local/"))).headers.get("content-type")).toContain(
      "text/html",
    );
    expect(await (await handler(new Request("http://local/api/health"))).json()).toEqual({
      status: "ok",
    });
    expect(await (await handler(new Request("http://local/asset.txt"))).text()).toBe("local");
    expect((await handler(new Request("http://local/", { method: "HEAD" }))).body).toBeNull();
    expect((await handler(new Request("http://local/", { method: "POST" }))).status).toBe(405);
    const missing = await handler(new Request("http://local/missing"));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: {
        code: "web.route_not_found",
        message: "web.route_not_found",
        requestId: "req_0000000000000001",
      },
    });
    expect(
      (await handler(new Request("http://local/missing", { method: "HEAD" }))).body,
    ).toBeNull();
    const failure = await handler(new Request("http://local/failure"));
    expect(failure.status).toBe(500);
    expect(await failure.text()).not.toContain("private detail");

    const invalidRequestId = await createRequestHandler({
      requestId: () => "private-request-value",
      routes: { "/": () => new Response("unreachable") },
    })(new Request("http://local/"));
    expect(invalidRequestId.status).toBe(500);
    expect(await invalidRequestId.text()).not.toContain("private-request-value");
  });

  test("rejects remote document assets and invalid bind addresses", () => {
    expect(() =>
      renderStaticDocument({ ...descriptor, clientModule: "https://remote.invalid/app.js" }),
    ).toThrow("web.document_invalid");
    expect(() =>
      renderStaticDocument({ ...descriptor, clientModule: "/\\remote.invalid/app.js" }),
    ).toThrow("web.document_invalid");
    expect(() => renderStaticDocument({ ...descriptor, clientModule: "/assets/app.js\n" })).toThrow(
      "web.document_invalid",
    );
    expect(parseServerAddress({})).toEqual({ hostname: "127.0.0.1", port: 3000 });
    expect(() => parseServerAddress({ HOST: "host name", PORT: "0" })).toThrow(
      "web.server_address_invalid",
    );
    expect(() => parseServerAddress({ PORT: "1e3" })).toThrow("web.server_address_invalid");
  });
});
