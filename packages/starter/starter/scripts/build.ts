import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { buildTailwindUtilities } from "@libre-ai/ui/tailwind";
import { renderStaticDocument } from "@libre-ai/web-platform";
import { starterDocument } from "../src/shared/document";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const assets = join(dist, "assets");

await rm(dist, { force: true, recursive: true });
await mkdir(join(dist, "static"), { recursive: true });
await mkdir(assets, { recursive: true });

const clientBuild = await Bun.build({
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  entrypoints: [join(root, "src/client/app.tsx")],
  minify: true,
  naming: "app.js",
  outdir: assets,
  sourcemap: "none",
  target: "browser",
});
if (!clientBuild.success) {
  throw new Error("web.client_build_failed");
}

const foundationCss = await Bun.file(join(root, "../../../packages/ui/src/styles.css")).text();
const utilityCss = await buildTailwindUtilities(["text-sm"]);
await Bun.write(join(assets, "styles.css"), `${foundationCss}\n${utilityCss}`);
await Bun.write(join(dist, "static/index.html"), renderStaticDocument(starterDocument()));
await Bun.write(
  join(dist, "manifest.webmanifest"),
  `${JSON.stringify(
    {
      background_color: "#f7f6f0",
      display: "standalone",
      id: "/",
      lang: "fr",
      name: "Libre AI — Journal Souverain",
      scope: "/",
      short_name: "Journal",
      start_url: "/static",
      theme_color: "#075e54",
    },
    null,
    2,
  )}\n`,
);
const cachedAssets = [
  "/assets/app.js",
  "/assets/styles.css",
  "/manifest.webmanifest",
  "/static",
] as const;
const cacheHasher = new Bun.CryptoHasher("sha256");
for (const path of cachedAssets) {
  const relativePath = path === "/static" ? "static/index.html" : path.slice(1);
  cacheHasher.update(`${relativePath}\0`);
  cacheHasher.update(await Bun.file(join(dist, relativePath)).arrayBuffer());
}
const cacheDigest = cacheHasher.digest("hex");
await Bun.write(
  join(dist, "sw.js"),
  `const CACHE="libre-ai-starter-${cacheDigest}";
const ASSETS=${JSON.stringify(cachedAssets)};
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("fetch",event=>{const url=new URL(event.request.url);if(event.request.method==="GET"&&url.origin===location.origin&&ASSETS.includes(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached??fetch(event.request)));}});
`,
);

console.log("Built SSR client, static document and local PWA assets");
