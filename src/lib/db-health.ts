import { cache } from "react";
import { sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";

export type DbStatus = "ok" | "unconfigured" | "error";

/** Bound the probe so an unresponsive database can't stall a page render. */
const PROBE_TIMEOUT_MS = 3000;

async function probe(): Promise<DbStatus> {
  if (!isDbConfigured()) return "unconfigured";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db().execute(sql`SELECT 1`),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("database probe timed out")), PROBE_TIMEOUT_MS);
      }),
    ]);
    return "ok";
  } catch {
    return "error";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Database reachability for the current request, deduplicated by React so the
 * layout and page share a single probe.
 *
 * Server-component reads go through `tryQuery`, which swallows errors and
 * returns an empty fallback. That keeps pages rendering, but on its own it is
 * indistinguishable from "you genuinely have no data" — during an outage a user
 * with a complete profile would be told to create one. Pages use this to tell
 * the two apart and say so honestly.
 */
export const getDbStatus = cache(probe);

export function isDbDegraded(status: DbStatus): boolean {
  return status !== "ok";
}
