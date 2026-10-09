import { type ReactNode, useEffect } from "react";
import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { type DocumentDescriptor, HtmlDocument } from "./document";

// `hydrateRoot` only schedules hydration: it returns before React has rendered,
// bound its props to the server DOM or compared the markup. Setting the marker
// right after it therefore announced a hydration that had not happened, and a
// recovered hydration (mismatch, then client render of the document) reset the
// `<html>` attributes afterwards, erasing the marker for good. A passive effect
// runs after the hydration commit and after `onRecoverableError`, so the marker
// appears only on a committed, interactive tree whose recovery verdict is final.
function HydrationMarker({ children }: { readonly children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return children;
}

export function hydrateDocument(descriptor: DocumentDescriptor): Root {
  return hydrateRoot(
    document,
    <HydrationMarker>
      <HtmlDocument {...descriptor} />
    </HydrationMarker>,
    {
      onRecoverableError() {
        document.documentElement.dataset.hydration = "recovered";
      },
    },
  );
}
