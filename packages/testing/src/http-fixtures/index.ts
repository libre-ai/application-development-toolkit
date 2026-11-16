/**
 * Deterministic HTTP fixtures for tests: unique client addresses (to isolate
 * rate-limit counters between tests) and typed request builders (same-origin
 * and cross-origin, to exercise cross-site refusal).
 *
 * Headers are plain string dictionaries so consumers compiled without the DOM
 * library can type them.
 */
export type HeaderDictionary = Record<string, string>;

// Reserved TLD (RFC 2606): never resolves, never a real third party.
const THIRD_PARTY_ORIGIN = "https://third-party.example";

// Process-wide counter, no randomness: two calls never collide.
let ipCounter = 0;

/**
 * Next unique IPv4 address in 10.0.0.0/8, derived from a process counter.
 * Unicity holds for 2^24 calls; the sequence then wraps (octets stay in 0..255).
 */
export function uniqueIp(): string {
  const n = ipCounter++ % 2 ** 24;
  return `10.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

/** Encode a flat object as application/x-www-form-urlencoded (space becomes "+"). */
export function formEncode(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function formPost(
  url: string,
  body: string,
  defaults: HeaderDictionary,
  extra: HeaderDictionary,
): Request {
  // Headers is case-insensitive: an extra header overrides a default of the same name.
  const headers = new Headers(defaults);
  for (const [name, value] of Object.entries(extra)) {
    headers.set(name, value);
  }
  return new Request(url, { method: "POST", headers, body });
}

/** Form POST as a browser sends it from the page's own origin. */
export function sameOriginPost(
  url: string,
  body: string,
  extraHeaders: HeaderDictionary = {},
): Request {
  return formPost(
    url,
    body,
    {
      "content-type": "application/x-www-form-urlencoded",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": uniqueIp(),
    },
    extraHeaders,
  );
}

/** Form POST from a third-party origin, to check that a cross-site refusal triggers. */
export function crossOriginPost(
  url: string,
  body: string,
  extraHeaders: HeaderDictionary = {},
): Request {
  return formPost(
    url,
    body,
    {
      "content-type": "application/x-www-form-urlencoded",
      origin: THIRD_PARTY_ORIGIN,
      "sec-fetch-site": "cross-site",
      "x-forwarded-for": uniqueIp(),
    },
    extraHeaders,
  );
}
