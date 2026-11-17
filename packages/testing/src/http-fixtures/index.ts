/**
 * Deterministic HTTP fixtures for tests: unique client addresses (to isolate
 * rate-limit counters between tests) and typed request builders (same-origin
 * and cross-origin, to exercise cross-site refusal).
 *
 * Headers are plain string dictionaries so consumers compiled without the DOM
 * library can type them.
 */
export type HeaderDictionary = Record<string, string>;

/**
 * Thrown when extra headers try to override `origin` or `sec-fetch-site`.
 * Those two headers are the very markers a cross-site check reads: letting an
 * extra header rewrite them would turn a same-origin fixture into a
 * cross-site one (or the reverse) without the test saying so.
 */
export class ProtectedHeaderOverrideError extends Error {
  readonly header: string;

  constructor(header: string) {
    super(`extra header "${header}" would override a protected origin marker`);
    this.name = "ProtectedHeaderOverrideError";
    this.header = header;
  }
}

// Lower-case names: header names are compared case-insensitively.
const PROTECTED_HEADERS: ReadonlySet<string> = new Set(["origin", "sec-fetch-site"]);

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
  // Headers is case-insensitive: an extra header overrides a default of the same
  // name, except the origin markers, which are refused whatever their case.
  const headers = new Headers(defaults);
  for (const [name, value] of Object.entries(extra)) {
    if (PROTECTED_HEADERS.has(name.toLowerCase())) {
      throw new ProtectedHeaderOverrideError(name);
    }
    headers.set(name, value);
  }
  return new Request(url, { method: "POST", headers, body });
}

/**
 * Form POST as a browser sends it from the page's own origin: `Origin` is the
 * target URL's origin (browsers send it on every POST) and `Sec-Fetch-Site` is
 * `same-origin`. Throws ProtectedHeaderOverrideError if `extraHeaders` names
 * either marker.
 */
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
      origin: new URL(url).origin,
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": uniqueIp(),
    },
    extraHeaders,
  );
}

/**
 * Form POST from a third-party origin, to check that a cross-site refusal
 * triggers. Throws ProtectedHeaderOverrideError if `extraHeaders` names
 * `origin` or `sec-fetch-site`.
 */
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
