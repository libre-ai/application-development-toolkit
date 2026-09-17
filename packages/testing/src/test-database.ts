import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Ephemeral PostgreSQL for integration tests (WP-G2-D01 → WP-G2-Q01).
 *
 * Mechanism: PGlite (real PostgreSQL compiled to WASM), arbitrated by the
 * 2026-07-20 owner run prompt over an embedded native binary. Two structural
 * limits the consumer must know:
 * - single connection: pool behavior is simulated (clearConnection applies
 *   the same DISCARD ALL a pool must issue before reuse), real pools are
 *   exercised against provisioned PostgreSQL in G4;
 * - the default session is a superuser, and RLS never applies to superusers:
 *   meaningful RLS tests must run under a non-superuser role (the adapters
 *   in @libre-ai/data do exactly that; the harness stays tenant-agnostic).
 */
export interface TestDatabase {
  readonly db: PGlite;
  /** Apply every *.sql file of a directory, lexicographically, one transaction each. */
  applyMigrations(dir: string): Promise<void>;
  /** Pool-clearing semantics: reset all session state as a pool must before reuse. */
  clearConnection(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = new PGlite();
  // Fail fast if the engine is not actually usable in this runtime.
  await db.query("SELECT 1");

  async function applyMigrations(dir: string): Promise<void> {
    const entries = await readdir(dir);
    const files = entries.filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const sql = await readFile(join(dir, file), "utf8");
      // db.exec is a single implicit transaction per call in PGlite when
      // wrapped explicitly; wrap to guarantee per-file atomicity.
      await db.exec("BEGIN");
      try {
        await db.exec(sql);
        await db.exec("COMMIT");
      } catch (error) {
        await db.exec("ROLLBACK");
        throw new Error(`migration ${file} failed: ${String(error)}`, {
          cause: error,
        });
      }
    }
  }

  async function clearConnection(): Promise<void> {
    await db.exec("DISCARD ALL");
  }

  return {
    db,
    applyMigrations,
    clearConnection,
    close: () => db.close(),
  };
}
