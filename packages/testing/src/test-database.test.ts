import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDatabase, type TestDatabase } from "./test-database";

// The harness is deliberately low level: it boots an ephemeral PostgreSQL
// (PGlite), applies owner migrations from a directory, and simulates
// pool-clearing semantics. Tenant semantics live in @libre-ai/data adapters,
// never here — the harness must not depend on the package it serves.

let migrationsDir: string;

beforeAll(async () => {
  migrationsDir = await mkdtemp(join(tmpdir(), "libre-ai-testing-"));
  await writeFile(
    join(migrationsDir, "0001_first.sql"),
    "CREATE TABLE harness_probe (id integer PRIMARY KEY);",
  );
  await writeFile(
    join(migrationsDir, "0002_second.sql"),
    "INSERT INTO harness_probe (id) VALUES (1);",
  );
});

afterAll(async () => {
  await rm(migrationsDir, { recursive: true, force: true });
});

describe("createTestDatabase", () => {
  let tdb: TestDatabase;

  beforeAll(async () => {
    tdb = await createTestDatabase();
  });

  afterAll(async () => {
    await tdb.close();
  });

  test("boots an ephemeral PostgreSQL and answers queries", async () => {
    const res = await tdb.db.query<{ one: number }>("SELECT 1 AS one");
    expect(res.rows[0]?.one).toBe(1);
  });

  test("applies migrations from a directory in lexicographic order", async () => {
    await tdb.applyMigrations(migrationsDir);
    const res = await tdb.db.query<{ n: number }>("SELECT count(*)::int AS n FROM harness_probe");
    expect(res.rows[0]?.n).toBe(1);
  });

  test("a failing migration aborts atomically (its statements roll back)", async () => {
    const badDir = await mkdtemp(join(tmpdir(), "libre-ai-testing-bad-"));
    await writeFile(
      join(badDir, "0001_bad.sql"),
      "INSERT INTO harness_probe (id) VALUES (2); INSERT INTO no_such_table VALUES (1);",
    );
    await expect(tdb.applyMigrations(badDir)).rejects.toThrow();
    const res = await tdb.db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM harness_probe WHERE id = 2",
    );
    expect(res.rows[0]?.n).toBe(0);
    await rm(badDir, { recursive: true, force: true });
  });

  test("clearConnection resets session state (pool-clearing semantics)", async () => {
    await tdb.db.exec("SET app.tenant_id = 'ten_leakyleakyleaky1'");
    await tdb.clearConnection();
    const res = await tdb.db.query<{ v: string | null }>(
      "SELECT current_setting('app.tenant_id', true) AS v",
    );
    // DISCARD ALL resets custom GUCs to their default (NULL/empty for app.*).
    expect(res.rows[0]?.v ?? "").toBe("");
  });
});
