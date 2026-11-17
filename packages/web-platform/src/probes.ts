import type { RouteHandler } from "./server";

/** Liveness: the process answers. It calls nothing, so it cannot fail on a dependency. */
export function liveRoute(): RouteHandler {
  return () => Response.json({ status: "ok" });
}

/**
 * Readiness: `check` resolves when the application can serve (for example a trivial query on
 * its database). The probe has no timeout of its own: the application bounds `check`.
 * The error is dropped on purpose, a probe is readable without authentication.
 */
export function readyRoute(check: () => void | Promise<void>): RouteHandler {
  return async () => {
    try {
      await check();
    } catch {
      return Response.json({ status: "not_ready" }, { status: 503 });
    }
    return Response.json({ status: "ready" });
  };
}
