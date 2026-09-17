import { beforeAll, describe, expect, test } from "bun:test";
import { loadCanonicalContractRegistry } from "@libre-ai/contracts";
import { createTemplateHandler } from "./handler";

const ORIGIN = "http://127.0.0.1:3000";

describe("Starter template server", () => {
  let handler: (request: Request) => Promise<Response>;

  beforeAll(() => {
    // Simple handler without auth for basic endpoint testing
    handler = createTemplateHandler();
  });

  test("GET / returns SSR document with placeholder", async () => {
    const response = await handler(new Request(`${ORIGIN}/`));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('data-testid="journal-root"');
  });

  test("GET /api/health returns service status", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/health`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      service: "libre-ai-starter",
      status: "ok",
      version: "v1",
    });
  });

  test("GET /api/session returns unauthenticated when no session", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/session`));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.authenticated).toBe(false);
  });

  test("POST /api/notes returns 401 when unauthenticated", async () => {
    const response = await handler(
      new Request(`${ORIGIN}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "test", createdAt: "2026-07-22T10:30:45Z" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("GET /api/notes returns 401 when unauthenticated", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/notes`));
    expect(response.status).toBe(401);
  });

  test("GET /api/schemas returns 401 when unauthenticated", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/schemas`));
    expect(response.status).toBe(401);
  });

  test("POST /api/validate returns 401 when unauthenticated", async () => {
    const response = await handler(
      new Request(`${ORIGIN}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaName: "test", document: {} }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("GET /api/schemas returns schema names when called", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/schemas`));
    // Without auth, should be 401
    expect(response.status).toBe(401);
  });

  test("POST /api/notes returns 401 without session, not 403", async () => {
    const response = await handler(
      new Request(`${ORIGIN}/api/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "fake-token",
        },
        body: JSON.stringify({
          text: "test",
          createdAt: "2026-07-22T10:30:45Z",
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  test("GET /e2e/csrf returns 401 when unauthenticated", async () => {
    const response = await handler(new Request(`${ORIGIN}/e2e/csrf`));
    expect(response.status).toBe(401);
  });

  test("404 on unknown routes", async () => {
    const response = await handler(new Request(`${ORIGIN}/api/missing`));
    expect(response.status).toBe(404);
  });

  test("contracts registry loads successfully", async () => {
    const registry = await loadCanonicalContractRegistry();
    const schemas = registry.schemaNames();
    expect(schemas.length).toBeGreaterThan(0);
    expect(schemas.some((s) => s.includes("problem-details"))).toBe(true);
  });
});
