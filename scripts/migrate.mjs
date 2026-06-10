/**
 * Deploy-time migration runner (spec 7.4/7.5).
 *
 * Wired into the Vercel build command: `node scripts/migrate.mjs && next build`.
 * - DATABASE_URL set   -> runs `drizzle-kit migrate`; a failure fails the
 *   build, so Vercel keeps the previous release serving traffic (fail-safe).
 * - DATABASE_URL unset -> skips with a warning so the very first deploy
 *   (before env vars are wired) still succeeds.
 */
import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[migrate] DATABASE_URL is not set — skipping migrations. " +
      "Set it in the Vercel environment-variable store to enable automatic migrations.",
  );
  process.exit(0);
}

console.log("[migrate] applying Drizzle migrations…");
const result = spawnSync("npx", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("[migrate] migration failed — aborting build (previous release stays live).");
  process.exit(result.status ?? 1);
}
console.log("[migrate] migrations applied.");
