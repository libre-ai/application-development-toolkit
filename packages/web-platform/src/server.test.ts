import { describe, expect, test } from "bun:test";
import { problem } from "./response";
import { createRequestHandler } from "./server";

const SERVER_ID = "req_0000000000000001";
const CLIENT_ID = "req_9999999999999999";

function clientRequest(path: string, method = "GET"): Request {
  return new Request(`http://local${path}`, { headers: { "X-Request-Id": CLIENT_ID }, method });
}

describe("request identifier", () => {
  const handler = createRequestHandler({
    assets: { "/asset.txt": { body: "local", contentType: "text/plain" } },
    requestId: () => SERVER_ID,
    routes: {
      "/": () => new Response("page"),
      "/failure": () => {
        throw new Error("private detail");
      },
      "/refusal": (_request, _url, requestId) => problem(401, "auth.example", requestId),
    },
  });

  test("every response carries the server identifier, never the client one", async () => {
    const cases: ReadonlyArray<readonly [path: string, method: string, status: number]> = [
      ["/", "GET", 200],
      ["/asset.txt", "GET", 200],
      ["/missing", "GET", 404],
      ["/", "POST", 405],
      ["/failure", "GET", 500],
      ["/", "HEAD", 200],
      ["/asset.txt", "HEAD", 200],
      ["/missing", "HEAD", 404],
      ["/failure", "HEAD", 500],
    ];
    for (const [path, method, status] of cases) {
      const response = await handler(clientRequest(path, method));
      expect([path, method, response.status]).toEqual([path, method, status]);
      expect([path, method, response.headers.get("X-Request-Id")]).toEqual([
        path,
        method,
        SERVER_ID,
      ]);
    }
  });

  test("a route receives the identifier and its refusal agrees with the header", async () => {
    const response = await handler(clientRequest("/refusal"));
    expect(response.status).toBe(401);
    expect(response.headers.get("X-Request-Id")).toBe(SERVER_ID);
    expect(await response.json()).toEqual({
      error: { code: "auth.example", message: "auth.example", requestId: SERVER_ID },
    });
  });

  test("an invalid identifier falls back without leaking its value", async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await createRequestHandler({
        requestId: () => "valeur-privee",
        routes: { "/": () => new Response("unreachable") },
      })(clientRequest("/", method));
      expect(response.status).toBe(500);
      expect(response.headers.get("X-Request-Id")).toBe("req_0000000000000000");
      expect(JSON.stringify([...response.headers])).not.toContain("valeur-privee");
      expect(await response.text()).not.toContain("valeur-privee");
    }
  });
});
