import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { type DocumentDescriptor, HtmlDocument } from "./document";

export function hydrateDocument(descriptor: DocumentDescriptor): Root {
  const root = hydrateRoot(document, <HtmlDocument {...descriptor} />, {
    onRecoverableError() {
      document.documentElement.dataset.hydration = "recovered";
    },
  });
  document.documentElement.dataset.hydrated = "true";
  return root;
}
