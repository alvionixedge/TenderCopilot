import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { tenderRequirements, tenders, tenderVersions } from "@/db/schema";
import type { NormalizedTender } from "./tender-feed";

/**
 * Upserts normalized tenders (spec §6.1). Idempotent via UNIQUE(source_url):
 * overlapping/repeat runs converge. New tenders also get v1 + extracted
 * requirements. Shared by the Vercel cron and the push-ingest endpoint used
 * by the external (GitHub Action) crawler.
 */
export async function ingestTenders(
  d: Db,
  incoming: NormalizedTender[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const t of incoming) {
    const value = t.estimatedValue != null ? t.estimatedValue.toFixed(2) : null;
    const emd = t.emd != null ? t.emd.toFixed(2) : null;

    const [row] = await d
      .insert(tenders)
      .values({
        source: t.source,
        sourceUrl: t.sourceUrl,
        title: t.title,
        department: t.department,
        estimatedValue: value,
        emd,
        submissionDate: t.submissionDate,
        status: "open",
      })
      .onConflictDoUpdate({
        target: tenders.sourceUrl,
        set: {
          // Refresh source too, so re-crawls correct any stale label (e.g. rows
          // previously classified "GeM" before that label was removed).
          source: t.source,
          title: t.title,
          department: t.department,
          estimatedValue: value,
          emd,
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
        const existing = await d
          .select({ id: tenderRequirements.id })
          .from(tenderRequirements)
          .where(eq(tenderRequirements.tenderId, row.id))
          .limit(1);
        if (existing.length === 0) {
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

  return { inserted, updated };
}
