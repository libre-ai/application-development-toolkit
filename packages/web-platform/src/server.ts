import { problem, secureResponse } from "./response";

/**
 * `requestId` is the identifier the router validated for this request. A route passes it to
 * `problem()` so that the refusal body and the `X-Request-Id` header agree.
 */
export type RouteHandler = (
  request: Request,
  url: URL,
  requestId: string,
) => Response | Promise<Response>;

export interface StaticAsset {
  body: BodyInit;
  cacheControl?: string;
  contentType: string;
}

export interface RequestHandlerOptions {
  assets?: Readonly<Record<string, StaticAsset>>;
  requestId: (request: Request) => string;
  routes: Readonly<Record<string, RouteHandler>>;
}

export function createRequestHandler({
  assets = {},
  requestId: createRequestId,
  routes,
}: RequestHandlerOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    let requestId: string;
    try {
      requestId = createRequestId(request);
      if (!/^req_[a-z0-9]{16,64}$/.test(requestId)) throw new Error("invalid request id");
    } catch {
      return finish(
        request,
        problem(500, "web.request_id_unavailable", FALLBACK_REQUEST_ID),
        FALLBACK_REQUEST_ID,
      );
    }

    const url = new URL(request.url);
    const route = routes[url.pathname];
    const asset = assets[url.pathname];

    if (route === undefined && asset === undefined) {
      return finish(request, problem(404, "web.route_not_found", requestId), requestId);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      const response = problem(405, "web.method_not_allowed", requestId);
      response.headers.set("Allow", "GET, HEAD");
      return finish(request, response, requestId);
    }

    try {
      let response: Response;
      if (asset !== undefined) {
        response = secureResponse(
          new Response(asset.body, {
            headers: { "Content-Type": asset.contentType },
          }),
          asset.cacheControl ?? "public, max-age=300",
        );
      } else if (route !== undefined) {
        response = secureResponse(await route(request, url, requestId));
      } else {
        return finish(request, problem(404, "web.route_not_found", requestId), requestId);
      }
      return finish(request, response, requestId);
    } catch {
      return finish(request, problem(500, "web.internal_error", requestId), requestId);
    }
  };
}

const FALLBACK_REQUEST_ID = "req_0000000000000000";

/**
 * Single exit of the router: every response carries the validated identifier. The value never
 * comes from the client request, and `set` overwrites one a route may have copied from it.
 */
function finish(request: Request, response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  return headless(request, response);
}

function headless(request: Request, response: Response): Response {
  if (request.method !== "HEAD") return response;
  return new Response(null, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function parseServerAddress(env: Readonly<Record<string, string | undefined>>): {
  hostname: string;
  port: number;
} {
  const hostname = env.HOST ?? "127.0.0.1";
  const rawPort = env.PORT ?? "3000";
  const port = Number(rawPort);
  if (
    !/^[a-zA-Z0-9.:_-]+$/.test(hostname) ||
    !/^[1-9][0-9]{0,4}$/.test(rawPort) ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    throw new Error("web.server_address_invalid");
  }
  return { hostname, port };
}
