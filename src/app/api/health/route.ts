import { NextResponse } from "next/server";
import { getDbStatus } from "@/lib/db-health";

/**
 * Post-deploy verification endpoint (spec 7.2 stage 5).
 *
 * Shallow by default — deliberately does NOT touch the database. Neon bills for
 * compute time and only scales to zero while idle, so an uptime monitor polling
 * a DB-backed health check every minute keeps the compute awake around the
 * clock and exhausts the monthly allowance on its own, even with no users.
 * Point uptime monitors at this default form.
 *
 * `?deep=1` additionally probes the database — for manual checks and post-deploy
 * verification. Do not poll it on a short interval.
 */
export async function GET(req: Request) {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const database = deep ? await getDbStatus() : "not_checked";

  return NextResponse.json({
    status: database === "error" ? "degraded" : "ok",
    database,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
  });
}
