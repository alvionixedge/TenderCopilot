import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

let _db: Db | null = null;

function createDb() {
  const url = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Set it in the Vercel environment-variable store (Section 7.6 of the spec).",
    );
  }
  // Serverless-friendly: small pool, no prepared statements (pgbouncer-safe).
  const client = postgres(url, { max: 5, prepare: false });
  return drizzle(client, { schema });
}

/** Lazily-initialised Drizzle client. Never constructed at build time. */
export function db(): Db {
  _db ??= createDb();
  return _db;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_POOL_URL || process.env.DATABASE_URL);
}

export { schema };
