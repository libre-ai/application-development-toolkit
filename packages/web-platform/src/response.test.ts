import { describe, expect, test } from "bun:test";
import { PROBLEM_STATUSES, problem, secureResponse } from "./response";

const REQUEST_ID = "req_0000000000000001";

describe("hardened responses", () => {
  test("adds Strict-Transport-Security and keeps the six existing headers", () => {
    const headers = secureResponse(new Response("x")).headers;
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'",
    );
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    );
    expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Cache-Control")).toBe("no-store");
  });

  test("builds a problem for each status of the closed list", async () => {
    expect([...PROBLEM_STATUSES]).toEqual([400, 401, 403, 404, 405, 409, 422, 429, 500, 503]);
    for (const status of PROBLEM_STATUSES) {
      const response = problem(status, "web.example", REQUEST_ID);
      expect(response.status).toBe(status);
      expect(response.headers.get("Content-Type")).toBe("application/problem+json");
      expect(await response.json()).toEqual({
        error: { code: "web.example", message: "web.example", requestId: REQUEST_ID },
      });
    }
  });

  test("refuses a status outside the list, a code without namespace and a foreign identifier", () => {
    expect(() => problem(418 as never, "web.example", REQUEST_ID)).toThrow("web.problem_invalid");
    expect(() => problem(400, "example", REQUEST_ID)).toThrow("web.problem_invalid");
    expect(() => problem(400, "web.example", "request-1")).toThrow("web.problem_invalid");
  });
});
