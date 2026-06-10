import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";

/**
 * Post-deploy verification endpoint (spec 7.2 stage 5).
 * Returns 200 with component statuses; database check is best-effort.
 */
export async function GET() {
  let database: "ok" | "unconfigured" | "error" = "unconfigured";
  if (isDbConfigured()) {
    try {
      await db().execute(sql`SELECT 1`);
      database = "ok";
    } catch {
      database = "error";
    }
  }
  return NextResponse.json({
    status: database === "error" ? "degraded" : "ok",
    database,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
  });
}
