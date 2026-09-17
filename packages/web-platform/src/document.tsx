import type { ReactNode } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { secureResponse } from "./response";

export interface DocumentDescriptor {
  app: ReactNode;
  clientModule?: string;
  description: string;
  lang?: "fr" | "en";
  manifest?: string;
  stylesheets?: readonly string[];
  title: string;
}

export function HtmlDocument({
  app,
  clientModule,
  description,
  lang = "fr",
  manifest,
  stylesheets = [],
  title,
}: DocumentDescriptor) {
  return (
    <html lang={lang} data-libre-ai-document="v1">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={description} />
        <meta name="color-scheme" content="light dark" />
        <title>{title}</title>
        {manifest ? <link rel="manifest" href={manifest} /> : null}
        {stylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div id="app-root">{app}</div>
        <noscript>
          <p>
            Cette page reste consultable sans JavaScript. Les interactions enrichies sont
            désactivées.
          </p>
        </noscript>
        {clientModule ? <script type="module" src={clientModule} /> : null}
      </body>
    </html>
  );
}

export async function renderSsrDocument(descriptor: DocumentDescriptor): Promise<Response> {
  assertDescriptor(descriptor);
  let renderingFailed = false;
  const stream = await renderToReadableStream(<HtmlDocument {...descriptor} />, {
    onError() {
      renderingFailed = true;
    },
  });
  await stream.allReady;
  return secureResponse(
    new Response(stream, {
      status: renderingFailed ? 500 : 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    "no-store",
  );
}

export function renderStaticDocument(descriptor: DocumentDescriptor): Uint8Array {
  assertDescriptor(descriptor);
  const markup = renderToStaticMarkup(<HtmlDocument {...descriptor} />);
  return new TextEncoder().encode(`<!doctype html>${markup}`);
}

function assertDescriptor(descriptor: DocumentDescriptor) {
  if (
    descriptor.title.length === 0 ||
    descriptor.title.length > 120 ||
    descriptor.description.length === 0 ||
    descriptor.description.length > 240 ||
    descriptor.stylesheets?.some((path) => !isLocalAbsolutePath(path)) ||
    (descriptor.clientModule !== undefined && !isLocalAbsolutePath(descriptor.clientModule)) ||
    (descriptor.manifest !== undefined && !isLocalAbsolutePath(descriptor.manifest))
  ) {
    throw new Error("web.document_invalid");
  }
}

function isLocalAbsolutePath(path: string): boolean {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    [...path].some((character) => character.charCodeAt(0) <= 0x20)
  ) {
    return false;
  }
  return new URL(path, "https://local.invalid").origin === "https://local.invalid";
}
