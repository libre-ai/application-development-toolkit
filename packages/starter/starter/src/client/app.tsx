import { hydrateDocument } from "@libre-ai/web-platform/client";
import { starterDocument } from "../shared/document";

hydrateDocument(starterDocument());

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
}
