import { problem, secureResponse } from "./response";

export type RouteHandler = (request: Request, url: URL) => Response | Promise<Response>;

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
      return headless(request, problem(500, "web.request_id_unavailable", "req_0000000000000000"));
    }

    const url = new URL(request.url);
    const route = routes[url.pathname];
    const asset = assets[url.pathname];

    if (route === undefined && asset === undefined) {
      return headless(request, problem(404, "web.route_not_found", requestId));
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      const response = problem(405, "web.method_not_allowed", requestId);
      response.headers.set("Allow", "GET, HEAD");
      return response;
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
        response = secureResponse(await route(request, url));
      } else {
        return problem(404, "web.route_not_found", requestId);
      }
      return headless(request, response);
    } catch {
      return headless(request, problem(500, "web.internal_error", requestId));
    }
  };
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
