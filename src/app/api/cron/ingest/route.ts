import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, tenderRequirements, tenders, tenderVersions } from "@/db/schema";
import { fetchTenders } from "@/lib/tender-feed";

export const maxDuration = 60;

/**
 * Scheduled tender ingestion (spec 2.3, 6.1). Invoked by Vercel Cron.
 * Pulls from the live feed (`TENDER_FEED_URL`) when configured, otherwise a
 * built-in sample set. Idempotent: UNIQUE(source_url) + upsert means
 * overlapping runs converge. Auth: `Authorization: Bearer <CRON_SECRET>`.
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

  let inserted = 0;
  let updated = 0;

  try {
    // Live feed when TENDER_FEED_URL is set; throws on feed failure so we never
    // silently fall back to sample data on a configured (production) feed.
    const { source, tenders: incoming } = await fetchTenders();

    for (const t of incoming) {
      const [row] = await d
        .insert(tenders)
        .values({
          source: t.source,
          sourceUrl: t.sourceUrl,
          title: t.title,
          department: t.department,
          estimatedValue: t.estimatedValue != null ? t.estimatedValue.toFixed(2) : null,
          emd: t.emd != null ? t.emd.toFixed(2) : null,
          submissionDate: t.submissionDate,
          status: "open",
        })
        .onConflictDoUpdate({
          target: tenders.sourceUrl,
          set: {
            title: t.title,
            department: t.department,
            estimatedValue: t.estimatedValue != null ? t.estimatedValue.toFixed(2) : null,
            emd: t.emd != null ? t.emd.toFixed(2) : null,
            submissionDate: t.submissionDate,
          },
        })
        .returning({ id: tenders.id, createdAt: tenders.createdAt });

      const isNew = Date.now() - row.createdAt.getTime() < 60_000;
      if (isNew) {
        inserted++;
        await d
          .insert(tenderVersions)
          .values({
            tenderId: row.id,
            version: 1,
            changeType: "original",
            impactClass: "scope",
            submissionDate: t.submissionDate,
            publishedAt: new Date(),
          })
          .onConflictDoNothing();

        if (t.requirements.length > 0) {
          const existingReqs = await d
            .select({ id: tenderRequirements.id })
            .from(tenderRequirements)
            .where(eq(tenderRequirements.tenderId, row.id))
            .limit(1);
          if (existingReqs.length === 0) {
            await d.insert(tenderRequirements).values(
              t.requirements.map((r) => ({
                tenderId: row.id,
                tenderVersion: 1,
                requirement: r.requirement,
                mandatory: r.mandatory,
                category: r.category,
              })),
            );
          }
        }
      } else {
        updated++;
      }
    }

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
