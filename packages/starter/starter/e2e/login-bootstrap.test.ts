import { expect, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Page } from "@playwright/test";
import { observeLoginBootstrap } from "./login-via-ui";

function fixture() {
  const events = new EventEmitter();
  const page = events as unknown as Pick<Page, "on" | "off">;
  return { events, page };
}
function request(path: string, type = "fetch") {
  return { url: () => `https://fixture.invalid${path}`, resourceType: () => type };
}
function response(path: string, status: number) {
  return {
    request: () => request(path, path.includes("app.js") ? "script" : "fetch"),
    status: () => status,
  };
}
function expectClean(events: EventEmitter) {
  for (const event of ["request", "response", "requestfailed"])
    expect(events.listenerCount(event)).toBe(0);
}

test("successful login stays silent and removes diagnostic listeners", async () => {
  const { events, page } = fixture();
  const emitted: string[] = [];
  await observeLoginBootstrap(
    page,
    "https://fixture.invalid/",
    async (navigation) => {
      events.emit("request", request("/api/session"));
      navigation.returnCommitted = true;
    },
    (line) => emitted.push(line),
  );
  expect(emitted).toEqual([]);
  expectClean(events);
});

test("failure emits only bounded bootstrap facts and rethrows the same primary error", async () => {
  const { events, page } = fixture();
  const emitted: string[] = [];
  const primary = new Error("private original error");
  await expect(
    observeLoginBootstrap(
      page,
      "https://fixture.invalid/",
      async (navigation) => {
        events.emit("request", request("/api/session?private-query"));
        navigation.callbackStatus = 303;
        navigation.returnCommitted = true;
        navigation.loadCompleted = true;
        events.emit("request", request("/assets/app.js?private-query", "script"));
        events.emit("response", response("/assets/app.js", 200));
        events.emit("request", request("/api/session"));
        events.emit("response", response("/api/session", 503));
        events.emit("requestfailed", request("/api/session"));
        events.emit("request", request("/unrelated-private-path"));
        events.emit("request", { url: () => "https://outside.invalid/api/session" });
        throw primary;
      },
      (line) => emitted.push(line),
    ),
  ).rejects.toBe(primary);
  expect(emitted).toHaveLength(1);
  const value = JSON.parse(emitted[0] ?? "");
  expect(value.captureUnavailable).toBe(false);
  expect(value.navigation).toEqual({
    callbackStatus: 303,
    returnCommitted: true,
    loadCompleted: true,
  });
  expect(value.beforeReturn.session.requests).toBe(1);
  expect(value.afterReturn.session).toEqual({
    requests: 1,
    responses: 1,
    failures: 1,
    lastStatus: 503,
  });
  expect(value.afterReturn.script).toEqual({
    requests: 1,
    responses: 1,
    failures: 0,
    lastStatus: 200,
  });
  expect(emitted[0]).not.toMatch(/private|https|fixture|cookie|header|body/);
  expectClean(events);
});

test("counters saturate and malformed statuses never enter the report", async () => {
  const { events, page } = fixture();
  const emitted: string[] = [];
  await expect(
    observeLoginBootstrap(
      page,
      "https://fixture.invalid/",
      async () => {
        for (let count = 0; count < 1_005; count += 1)
          events.emit("request", request("/api/session"));
        events.emit("response", response("/api/session", Number.NaN));
        throw new Error("synthetic");
      },
      (line) => emitted.push(line),
    ),
  ).rejects.toThrow("synthetic");
  const value = JSON.parse(emitted[0] ?? "");
  expect(value.beforeReturn.session.requests).toBe(1_000);
  expect(value.beforeReturn.session.lastStatus).toBeNull();
  expect(value.saturated).toBe(true);
  expectClean(events);
});

test("an unavailable logger cannot replace the primary failure", async () => {
  const { events, page } = fixture();
  const primary = new Error("primary");
  const warning = spyOn(console, "error").mockImplementation(() => {});
  try {
    await expect(
      observeLoginBootstrap(
        page,
        "https://fixture.invalid/",
        async () => {
          throw primary;
        },
        () => {
          throw new Error("private logger error");
        },
      ),
    ).rejects.toBe(primary);
    expect(warning).toHaveBeenCalledWith("login-bootstrap-diagnostic-unavailable");
    expectClean(events);
  } finally {
    warning.mockRestore();
  }
});

test("malformed event metadata is contained without changing the primary error", async () => {
  const { events, page } = fixture();
  const emitted: string[] = [];
  const primary = new Error("primary");
  await expect(
    observeLoginBootstrap(
      page,
      "https://fixture.invalid/",
      async () => {
        events.emit("request", { url: () => "not a valid URL private-data" });
        throw primary;
      },
      (line) => emitted.push(line),
    ),
  ).rejects.toBe(primary);
  expect(JSON.parse(emitted[0] ?? "").captureUnavailable).toBe(true);
  expect(emitted[0]).not.toContain("private-data");
  expectClean(events);
});

test("failure of both diagnostic sinks still preserves the primary error", async () => {
  const { events, page } = fixture();
  const primary = new Error("primary");
  const warning = spyOn(console, "error").mockImplementation(() => {
    throw new Error("secondary");
  });
  try {
    await expect(
      observeLoginBootstrap(
        page,
        "https://fixture.invalid/",
        async () => {
          throw primary;
        },
        () => {
          throw new Error("logger");
        },
      ),
    ).rejects.toBe(primary);
    expectClean(events);
  } finally {
    warning.mockRestore();
  }
});
