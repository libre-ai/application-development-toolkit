import { join } from "node:path";
import { createRequestHandler, renderSsrDocument, type StaticAsset } from "@libre-ai/web-platform";
import { referenceDocument } from "../shared/document";

export function createTemplateHandler(
  distRoot = join(import.meta.dir, "../../dist"),
  requestId = () => `req_${crypto.randomUUID().replaceAll("-", "")}`,
) {
  const assets: Record<string, StaticAsset> = {
    "/assets/app.js": {
      body: Bun.file(join(distRoot, "assets/app.js")),
      cacheControl: "public, max-age=300",
      contentType: "text/javascript; charset=utf-8",
    },
    "/assets/icon.svg": {
      body: Bun.file(join(distRoot, "assets/icon.svg")),
      cacheControl: "public, max-age=300",
      contentType: "image/svg+xml",
    },
    "/assets/styles.css": {
      body: Bun.file(join(distRoot, "assets/styles.css")),
      cacheControl: "public, max-age=300",
      contentType: "text/css; charset=utf-8",
    },
    "/manifest.webmanifest": {
      body: Bun.file(join(distRoot, "manifest.webmanifest")),
      contentType: "application/manifest+json",
    },
    "/static": {
      body: Bun.file(join(distRoot, "static/index.html")),
      contentType: "text/html; charset=utf-8",
    },
    "/sw.js": {
      body: Bun.file(join(distRoot, "sw.js")),
      contentType: "text/javascript; charset=utf-8",
    },
  };

  return createRequestHandler({
    assets,
    requestId,
    routes: {
      "/": () => renderSsrDocument(referenceDocument()),
      "/api/health": () =>
        Response.json({
          service: "libre-ai-bun-reference",
          status: "ok",
          version: "v1",
        }),
    },
  });
}
