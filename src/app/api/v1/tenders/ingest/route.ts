import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { ingestTenders } from "@/lib/ingest";
import type { NormalizedTender } from "@/lib/tender-feed";

export const maxDuration = 60;

/**
 * POST /api/v1/tenders/ingest — push-ingestion for an EXTERNAL crawler (e.g.
 * the scheduled GitHub Action, which runs on a clean IP and can render JS).
 * Authenticated with the same `CRON_SECRET` bearer as the cron. Body:
 *   { source?: string, tenders: [{ sourceUrl, title, source?, department?,
 *     estimatedValue?, emd?, submissionDate? (ISO), requirements?: [...] }] }
 */
const itemSchema = z.object({
  source: z.string().max(40).optional(),
  sourceUrl: z.string().url(),
  title: z.string().min(1).max(500),
  department: z.string().max(255).nullish(),
  estimatedValue: z.coerce.number().nonnegative().nullish(),
  emd: z.coerce.number().nonnegative().nullish(),
  submissionDate: z.string().nullish(),
  requirements: z
    .array(
      z.object({
        requirement: z.string().min(1),
        mandatory: z.boolean().optional(),
        category: z.string().nullish(),
      }),
    )
    .optional(),
});

const bodySchema = z.object({
  source: z.string().max(40).optional(),
  tenders: z.array(itemSchema).min(1).max(500),
});

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Invalid ingestion token." } },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_json", message: "Body must be JSON." } },
      { status: 400 },
    );
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid." } },
      { status: 422 },
    );
  }

  const source = parsed.data.source ?? "external";
  const incoming: NormalizedTender[] = parsed.data.tenders.map((t) => ({
    source: t.source ?? "CPPP",
    sourceUrl: t.sourceUrl,
    title: t.title,
    department: t.department ?? null,
    estimatedValue: t.estimatedValue ?? null,
    emd: t.emd ?? null,
    submissionDate: t.submissionDate ? new Date(t.submissionDate) : null,
    requirements: (t.requirements ?? []).map((r) => ({
      requirement: r.requirement,
      mandatory: r.mandatory ?? true,
      category: r.category ?? null,
    })),
  }));

  const d = db();
  const [job] = await d
    .insert(jobs)
    .values({ type: "ingest", status: "running", payload: { source } })
    .returning({ id: jobs.id });

  try {
    const { inserted, updated } = await ingestTenders(d, incoming);
    const { eq } = await import("drizzle-orm");
    await d
      .update(jobs)
      .set({ status: "succeeded", updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    return NextResponse.json({ ok: true, source, received: incoming.length, inserted, updated });
  } catch (err) {
    const { eq } = await import("drizzle-orm");
    await d
      .update(jobs)
      .set({ status: "failed", lastError: String(err), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    throw err;
  }
}
