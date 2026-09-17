const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; manifest-src 'self'; object-src 'none'; script-src 'self'; style-src 'self'; worker-src 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export function secureResponse(response: Response, cacheControl = "no-store"): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export function problem(status: 400 | 404 | 405 | 500, code: string, requestId: string): Response {
  if (
    !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_.-]*$/.test(code) ||
    !/^req_[a-z0-9]{16,64}$/.test(requestId)
  ) {
    throw new Error("web.problem_invalid");
  }
  return secureResponse(
    Response.json(
      {
        error: {
          code,
          message: code,
          requestId,
        },
      },
      {
        status,
        headers: { "Content-Type": "application/problem+json" },
      },
    ),
  );
}
