import type { DocumentDescriptor } from "@libre-ai/web-platform";
import { ReferenceApp } from "../ui/reference-app";

export function referenceDocument(): DocumentDescriptor {
  return {
    app: <ReferenceApp />,
    clientModule: "/assets/app.js",
    description: "Référence Bun et React accessible de Libre AI.",
    lang: "fr",
    manifest: "/manifest.webmanifest",
    stylesheets: ["/assets/styles.css"],
    title: "Libre AI — référence Bun",
  };
}
