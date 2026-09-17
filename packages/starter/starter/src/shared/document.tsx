import type { DocumentDescriptor } from "@libre-ai/web-platform";
import { JournalApp } from "../ui/journal-app";

export function starterDocument(): DocumentDescriptor {
  return {
    app: <JournalApp />,
    clientModule: "/assets/app.js",
    description: "Journal souverain avec validation de contrats Libre AI.",
    lang: "fr",
    manifest: "/manifest.webmanifest",
    stylesheets: ["/assets/styles.css"],
    title: "Libre AI — Journal Souverain",
  };
}
