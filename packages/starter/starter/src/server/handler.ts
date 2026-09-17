import { join } from "node:path";
import type { AuthHttpBoundary, SessionService } from "@libre-ai/auth-web";
import { SESSION_COOKIE, verifyCsrf } from "@libre-ai/auth-web";
import { loadCanonicalContractRegistry } from "@libre-ai/contracts";
import {
  createRequestHandler,
  renderSsrDocument,
  type StaticAsset,
  secureResponse,
} from "@libre-ai/web-platform";
import { addNote, createJournal, type Journal, listNotes } from "../domain/journal";
import { starterDocument } from "../shared/document";

interface TemplateHandlerOptions {
  boundary?: AuthHttpBoundary;
  origin?: string;
  sessions?: SessionService;
  distRoot?: string;
}

// Per-session state: maps session cookie to user's journal
const sessionJournals = new Map<string, Journal>();

// Lazy-load the contracts registry once at startup
let contractsRegistry: Awaited<ReturnType<typeof loadCanonicalContractRegistry>> | null = null;

async function getContractsRegistry() {
  if (contractsRegistry === null) {
    contractsRegistry = await loadCanonicalContractRegistry();
  }
  return contractsRegistry;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (header === null) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = rest.join("=");
      return value.length === 0 ? null : value;
    }
  }
  return null;
}

function requestId(): string {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

function problemResponse(status: number, code: string, id: string): Response {
  return secureResponse(
    Response.json(
      { error: { code, message: code, requestId: id } },
      { headers: { "Content-Type": "application/problem+json" }, status },
    ),
  );
}

export function createTemplateHandler(
  options?: TemplateHandlerOptions,
): (request: Request) => Promise<Response> {
  const boundary = options?.boundary;
  const origin = options?.origin ?? "http://127.0.0.1:3000";
  const sessions = options?.sessions;
  const distRoot = options?.distRoot ?? join(import.meta.dir, "../../dist");

  // Build static assets map
  const assets: Record<string, StaticAsset> = {
    "/assets/app.js": {
      body: Bun.file(join(distRoot, "assets/app.js")),
      cacheControl: "public, max-age=300",
      contentType: "text/javascript; charset=utf-8",
    },
    "/assets/styles.css": {
      body: Bun.file(join(distRoot, "assets/styles.css")),
      cacheControl: "public, max-age=300",
      contentType: "text/css; charset=utf-8",
    },
    "/manifest.webmanifest": {
      body: Bun.file(join(distRoot, "manifest.webmanifest")),
      cacheControl: "public, max-age=3600",
      contentType: "application/manifest+json",
    },
    "/static": {
      body: Bun.file(join(distRoot, "static/index.html")),
      cacheControl: "public, max-age=300",
      contentType: "text/html; charset=utf-8",
    },
    "/sw.js": {
      body: Bun.file(join(distRoot, "sw.js")),
      cacheControl: "public, max-age=300",
      contentType: "text/javascript; charset=utf-8",
    },
  };

  // Create routes that require GET/HEAD only (for createRequestHandler)
  const routes: Record<string, (request: Request, url: URL) => Response | Promise<Response>> = {
    "/": async (_request) => {
      return renderSsrDocument(starterDocument());
    },

    "/api/health": async () => {
      return Response.json(
        {
          service: "libre-ai-starter",
          status: "ok",
          version: "v1",
        },
        { status: 200 },
      );
    },

    "/api/session": async (request) => {
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return Response.json({ authenticated: false }, { status: 200 });
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return Response.json({ authenticated: false }, { status: 200 });
        }
        return Response.json(
          {
            authenticated: true,
            userId: resolved.record.userId,
            tenantId: resolved.record.tenantId,
          },
          { status: 200 },
        );
      }

      return Response.json({ authenticated: false }, { status: 200 });
    },

    "/e2e/csrf": async (request) => {
      const id = requestId();
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return problemResponse(401, "auth.session_missing", id);
      }
      if (sessions) {
        try {
          const { csrfToken } = await sessions.refreshCsrfSecret(sessionCookie);
          return Response.json({ csrfToken }, { status: 200 });
        } catch {
          return problemResponse(401, "auth.session_invalid", id);
        }
      }
      return problemResponse(401, "auth.session_invalid", id);
    },

    "/api/schemas": async (request) => {
      const id = requestId();
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return problemResponse(401, "auth.session_missing", id);
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return problemResponse(401, "auth.session_invalid", id);
        }
      }

      try {
        const registry = await getContractsRegistry();
        const schemaNames = registry.schemaNames();
        return Response.json({ data: schemaNames }, { status: 200 });
      } catch {
        return problemResponse(500, "web.internal_error", id);
      }
    },
  };

  const requestHandler = createRequestHandler({
    assets,
    requestId: () => requestId(),
    routes,
  });

  // Return a wrapper that handles POST/DELETE routes before delegating to createRequestHandler
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const _id = requestId();

    // Auth-web boundary routes (handle POST/DELETE first)
    if (boundary) {
      if (url.pathname === "/v1/auth/login" && request.method === "POST") {
        return secureResponse(await boundary.handleLogin(request));
      }
      if (url.pathname === "/v1/auth/callback" && request.method === "GET") {
        return secureResponse(await boundary.handleCallback(request));
      }
      if (url.pathname === "/v1/auth/session" && request.method === "GET") {
        return secureResponse(await boundary.handleGetSession(request));
      }
      if (url.pathname === "/v1/auth/session" && request.method === "DELETE") {
        return secureResponse(await boundary.handleDeleteSession(request));
      }
    }

    // POST /api/notes - add a note to the journal
    if (url.pathname === "/api/notes" && request.method === "POST") {
      const id = requestId();
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return secureResponse(problemResponse(401, "auth.session_missing", id));
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return secureResponse(problemResponse(401, "auth.session_invalid", id));
        }
      }

      // CSRF check
      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (resolved.ok) {
          const csrf = await verifyCsrf({
            allowedOrigin: origin,
            csrfSecretDigest: resolved.record.csrfSecretDigest,
            csrfToken: request.headers.get("X-CSRF-Token") ?? "",
            origin: request.headers.get("Origin"),
            secFetchSite: request.headers.get("Sec-Fetch-Site"),
          });
          if (!csrf.ok) {
            return secureResponse(problemResponse(403, "auth.csrf_invalid", id));
          }
        }
      }

      try {
        const body = (await request.json()) as Record<string, unknown>;
        const text = body.text;
        const createdAt = body.createdAt;

        if (typeof text !== "string" || typeof createdAt !== "string") {
          return secureResponse(problemResponse(400, "web.request_body_invalid", id));
        }

        let journal = sessionJournals.get(sessionCookie) ?? createJournal();

        const result = addNote(journal, text, createdAt);
        if (!result.ok) {
          return secureResponse(problemResponse(422, result.refusal, id));
        }

        journal = result.value;
        sessionJournals.set(sessionCookie, journal);

        return secureResponse(Response.json({ ok: true }, { status: 201 }));
      } catch {
        return secureResponse(problemResponse(400, "web.request_body_invalid", id));
      }
    }

    // GET /api/notes - list notes for the session
    if (url.pathname === "/api/notes" && request.method === "GET") {
      const id = requestId();
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return secureResponse(problemResponse(401, "auth.session_missing", id));
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return secureResponse(problemResponse(401, "auth.session_invalid", id));
        }
      }

      const journal = sessionJournals.get(sessionCookie) ?? createJournal();
      const notes = listNotes(journal);

      return secureResponse(Response.json({ data: notes }, { status: 200 }));
    }

    // POST /api/validate - validation playground
    if (url.pathname === "/api/validate" && request.method === "POST") {
      const id = requestId();
      const sessionCookie = readCookie(request, SESSION_COOKIE);
      if (sessionCookie === null) {
        return secureResponse(problemResponse(401, "auth.session_missing", id));
      }

      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (!resolved.ok) {
          return secureResponse(problemResponse(401, "auth.session_invalid", id));
        }
      }

      // CSRF check
      if (sessions) {
        const resolved = await sessions.resolveSession(sessionCookie);
        if (resolved.ok) {
          const csrf = await verifyCsrf({
            allowedOrigin: origin,
            csrfSecretDigest: resolved.record.csrfSecretDigest,
            csrfToken: request.headers.get("X-CSRF-Token") ?? "",
            origin: request.headers.get("Origin"),
            secFetchSite: request.headers.get("Sec-Fetch-Site"),
          });
          if (!csrf.ok) {
            return secureResponse(problemResponse(403, "auth.csrf_invalid", id));
          }
        }
      }

      try {
        const body = (await request.json()) as Record<string, unknown>;
        const schemaName = body.schemaName;
        const document = body.document;

        if (typeof schemaName !== "string") {
          return secureResponse(problemResponse(400, "web.request_body_invalid", id));
        }

        const registry = await getContractsRegistry();

        // Try to validate
        try {
          const result = registry.validate(schemaName, document);
          if (result.ok) {
            return secureResponse(Response.json({ ok: true }, { status: 200 }));
          }
          return secureResponse(
            Response.json({ ok: false, issues: result.issues }, { status: 200 }),
          );
        } catch (error) {
          // Schema not found
          if (error instanceof Error && error.message.includes("not found")) {
            return secureResponse(problemResponse(404, "contracts.schema_not_found", id));
          }
          throw error;
        }
      } catch {
        return secureResponse(problemResponse(400, "web.request_body_invalid", id));
      }
    }

    // Delegate to createRequestHandler for GET/HEAD routes and static assets
    return requestHandler(request);
  };
}
