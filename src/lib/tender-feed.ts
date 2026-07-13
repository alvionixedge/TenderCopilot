import { z } from "zod";

/**
 * Tender ingestion source (spec §2.3, §6.1) — LIVE DATA ONLY. There is no
 * sample/demo fallback: every ingested tender comes from a real source.
 *
 * Resolution:
 *  - `TENDER_FEED_URL` set  → fetch that provider's JSON feed (paid aggregator
 *    for GeM / your own crawler / data.gov.in). A fetch/parse failure throws.
 *  - otherwise              → direct CPPP crawler (eprocure.gov.in), the free
 *    cross-government source. A crawl failure throws.
 *
 * A failure fails the ingestion job (leaving existing tenders untouched) — it
 * never substitutes fake data.
 */
export interface NormalizedTender {
  source: string; // GeM | CPPP | StatePortal | PSU | <provider label>
  sourceUrl: string; // canonical, unique (exact-dedupe key)
  title: string;
  department: string | null;
  estimatedValue: number | null;
  emd: number | null;
  submissionDate: Date | null;
  requirements: { requirement: string; mandatory: boolean; category: string | null }[];
}


// Tolerant schema for a single feed item. Providers differ, so most fields are
// optional; only a canonical URL and a title are required. A feed item may give
// an absolute `submissionDate` (ISO) or a relative `daysToDeadline`.
export const feedItemSchema = z
  .object({
    source: z.string().max(40).optional(),
    sourceUrl: z.string().url().optional(),
    url: z.string().url().optional(), // alias
    title: z.string().min(1),
    department: z.string().nullish(),
    estimatedValue: z.coerce.number().nonnegative().nullish(),
    emd: z.coerce.number().nonnegative().nullish(),
    submissionDate: z.string().nullish(),
    daysToDeadline: z.coerce.number().int().nullish(),
    requirements: z
      .array(
        z.object({
          requirement: z.string().min(1),
          mandatory: z.coerce.boolean().optional(),
          category: z.string().nullish(),
        }),
      )
      .optional(),
  })
  .transform((t): NormalizedTender | null => {
    const sourceUrl = t.sourceUrl || t.url;
    if (!sourceUrl) return null;
    let submissionDate: Date | null = null;
    if (t.submissionDate) {
      const d = new Date(t.submissionDate);
      submissionDate = isNaN(d.getTime()) ? null : d;
    } else if (t.daysToDeadline != null) {
      const d = new Date();
      d.setDate(d.getDate() + t.daysToDeadline);
      submissionDate = d;
    }
    return {
      source: t.source || "External",
      sourceUrl,
      title: t.title,
      department: t.department ?? null,
      estimatedValue: t.estimatedValue ?? null,
      emd: t.emd ?? null,
      submissionDate,
      requirements: (t.requirements ?? []).map((r) => ({
        requirement: r.requirement,
        mandatory: r.mandatory ?? true,
        category: r.category ?? null,
      })),
    };
  });

const MAX_TENDERS = 500;

/**
 * Resolves the LIVE ingestion source. `TENDER_FEED_URL` → provider feed;
 * otherwise the direct CPPP crawler. Either way real data — a failure throws
 * (fails the job) and never substitutes samples.
 */
export async function fetchTenders(opts?: { pages?: number }): Promise<{
  source: "feed" | "cppp";
  tenders: NormalizedTender[];
}> {
  const url = process.env.TENDER_FEED_URL;

  // Default live source: direct CPPP crawler (free, no key) — real central,
  // state and PSU tenders straight from eprocure.gov.in.
  if (!url) {
    const { crawlCppp } = await import("./crawlers/cppp");
    // Caller may cap depth (e.g. the Vercel cron stays shallow to fit the 60s
    // function limit); otherwise fall back to TENDER_CRAWL_PAGES / default 15.
    const pages = Math.max(
      1,
      Math.min(20, opts?.pages ?? (Number(process.env.TENDER_CRAWL_PAGES) || 15)),
    );
    return { source: "cppp", tenders: await crawlCppp(pages) };
  }

  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.TENDER_FEED_API_KEY;
  if (key) {
    const headerName = process.env.TENDER_FEED_API_KEY_HEADER;
    if (headerName) headers[headerName.toLowerCase()] = key;
    else headers["authorization"] = `Bearer ${key}`;
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
  if (!res.ok) {
    throw new Error(`Tender feed responded ${res.status} ${res.statusText}`);
  }
  const json: unknown = await res.json();

  // Accept a bare array or a common envelope ({items|tenders|data|records:[...]}).
  const raw = Array.isArray(json)
    ? json
    : ((json as Record<string, unknown>)?.items ??
        (json as Record<string, unknown>)?.tenders ??
        (json as Record<string, unknown>)?.data ??
        (json as Record<string, unknown>)?.records ??
        []);
  if (!Array.isArray(raw)) {
    throw new Error("Tender feed did not return an array (or {items|tenders|data|records:[]}).");
  }

  const tenders: NormalizedTender[] = [];
  for (const item of raw.slice(0, MAX_TENDERS)) {
    const parsed = feedItemSchema.safeParse(item);
    if (parsed.success && parsed.data) tenders.push(parsed.data);
  }
  if (tenders.length === 0) {
    throw new Error("Tender feed returned no usable items (check the field mapping).");
  }
  return { source: "feed", tenders };
}
