import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { ingestTenders } from "@/lib/ingest";
import { fetchTenders } from "@/lib/tender-feed";

export const maxDuration = 60;

/**
 * Scheduled tender ingestion (spec 2.3, 6.1). Invoked by Vercel Cron.
 * Pulls from the live feed (`TENDER_FEED_URL`) when configured, otherwise the
 * direct CPPP crawler (live only — no sample fallback). Idempotent:
 * UNIQUE(source_url) + upsert means overlapping runs converge. Stays shallow
 * to fit the 60s function limit. Auth: `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  const d = db();
  const [job] = await d
    .insert(jobs)
    .values({ type: "ingest", status: "running", payload: { source: "scheduled" } })
    .returning({ id: jobs.id });

  try {
    // Live feed / CPPP crawler when configured; throws on failure so we never
    // silently fall back to sample data on a configured (production) source.
    // Stay shallow: crawl + sequential upsert must finish inside maxDuration
    // (60s). The deeper multi-page crawl runs in the GitHub Action, which has
    // no such limit and pushes in batches. This cron is a lightweight top-up
    // of the newest listings; env CRON_INGEST_PAGES can tune it (default 4).
    const pages = Math.max(1, Math.min(8, Number(process.env.CRON_INGEST_PAGES) || 4));
    const { source, tenders: incoming } = await fetchTenders({ pages });
    const { inserted, updated } = await ingestTenders(d, incoming);

    await d
      .update(jobs)
      .set({ status: "succeeded", payload: { source }, updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    return NextResponse.json({ ok: true, source, inserted, updated });
  } catch (err) {
    await d
      .update(jobs)
      .set({ status: "failed", lastError: String(err), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    throw err;
  }
}
