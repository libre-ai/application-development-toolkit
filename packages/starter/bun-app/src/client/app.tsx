import { hydrateDocument } from "@libre-ai/web-platform/client";
import { referenceDocument } from "../shared/document";

hydrateDocument(referenceDocument());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
}
