import { isDbConfigured } from "@/db";

/**
 * Runs a database read for a server component, returning `fallback` when
 * the database is not configured or unreachable. Keeps freshly-deployed
 * environments rendering (with setup guidance) instead of crashing while
 * env vars are still being wired up.
 */
export async function tryQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.error("[query] failed", err);
    return fallback;
  }
}
