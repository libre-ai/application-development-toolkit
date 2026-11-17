import { describe, expect, test } from "bun:test";
import {
  crossOriginPost,
  formEncode,
  type HeaderDictionary,
  ProtectedHeaderOverrideError,
  sameOriginPost,
  uniqueIp,
} from "./index";

const TARGET = "https://app.test/submit";

describe("uniqueIp", () => {
  test("1000 calls give 1000 distinct addresses of the form 10.a.b.c", () => {
    const ips = Array.from({ length: 1000 }, () => uniqueIp());
    expect(new Set(ips).size).toBe(1000);
    for (const ip of ips) {
      const m = /^10\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
      expect(m).not.toBeNull();
      for (const octet of (m ?? []).slice(1)) {
        expect(Number(octet)).toBeGreaterThanOrEqual(0);
        expect(Number(octet)).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("formEncode", () => {
  test("encodes spaces as plus", () => {
    expect(formEncode({ q: "hello world" })).toBe("q=hello+world");
  });

  test("escapes reserved characters and joins fields with &", () => {
    expect(formEncode({ a: "1&2", b: "x=y" })).toBe("a=1%262&b=x%3Dy");
  });
});

describe("sameOriginPost", () => {
  test("carries the expected headers, method and an intact body", async () => {
    const body = formEncode({ q: "hello world" });
    const req = sameOriginPost(TARGET, body);
    expect(req.method).toBe("POST");
    expect(req.url).toBe(TARGET);
    expect(req.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(req.headers.get("sec-fetch-site")).toBe("same-origin");
    expect(req.headers.get("x-forwarded-for")).toMatch(/^10\.\d+\.\d+\.\d+$/);
    expect(await req.text()).toBe(body);
  });

  test("carries the target's own Origin, as every browser does on a POST", () => {
    expect(sameOriginPost(TARGET, "a=1").headers.get("origin")).toBe("https://app.test");
    expect(sameOriginPost("http://localhost:3000/x?y=1", "a=1").headers.get("origin")).toBe(
      "http://localhost:3000",
    );
  });

  test("an extra header does not erase the same-origin marker", () => {
    const req = sameOriginPost(TARGET, "a=1", { authorization: "Basic dGVzdDp0ZXN0" });
    expect(req.headers.get("sec-fetch-site")).toBe("same-origin");
    expect(req.headers.get("authorization")).toBe("Basic dGVzdDp0ZXN0");
  });

  test("an extra header can override a default, case-insensitively", () => {
    const req = sameOriginPost(TARGET, "{}", { "Content-Type": "application/json" });
    expect(req.headers.get("content-type")).toBe("application/json");
  });

  test("two consecutive posts have different x-forwarded-for", () => {
    const a = sameOriginPost(TARGET, "a=1");
    const b = sameOriginPost(TARGET, "a=1");
    expect(a.headers.get("x-forwarded-for")).not.toBe(b.headers.get("x-forwarded-for"));
  });
});

describe("crossOriginPost", () => {
  test("carries a third-party Origin and no same-origin marker", () => {
    const req = crossOriginPost(TARGET, "a=1");
    const origin = req.headers.get("origin");
    expect(origin).not.toBeNull();
    expect(new URL(origin ?? "").origin).not.toBe(new URL(TARGET).origin);
    expect(req.headers.get("sec-fetch-site")).not.toBe("same-origin");
    expect(req.headers.get("content-type")).toBe("application/x-www-form-urlencoded");
  });

  test("a unique x-forwarded-for per request", () => {
    const a = crossOriginPost(TARGET, "a=1");
    const b = crossOriginPost(TARGET, "a=1");
    expect(a.headers.get("x-forwarded-for")).not.toBe(b.headers.get("x-forwarded-for"));
  });

  test("an extra header cannot restore a same-origin marker by accident of defaults", async () => {
    const req = crossOriginPost(TARGET, "a=1", { "x-test": "1" });
    expect(req.headers.get("x-test")).toBe("1");
    expect(req.headers.get("sec-fetch-site")).toBe("cross-site");
    expect(req.headers.get("origin")).toBe("https://third-party.example");
    expect(await req.text()).toBe("a=1");
  });
});

describe("origin markers cannot be overridden by extra headers", () => {
  const builders = { sameOriginPost, crossOriginPost } as const;
  const overrides: ReadonlyArray<HeaderDictionary> = [
    { "sec-fetch-site": "same-origin" },
    { "Sec-Fetch-Site": "cross-site" },
    { origin: "https://evil.example" },
    { ORIGIN: "https://app.test" },
  ];

  for (const [name, build] of Object.entries(builders)) {
    for (const extra of overrides) {
      test(`${name} refuses ${JSON.stringify(extra)}`, () => {
        expect(() => build(TARGET, "a=1", extra)).toThrow(ProtectedHeaderOverrideError);
      });
    }
  }
});
