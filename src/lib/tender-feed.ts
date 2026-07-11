import { z } from "zod";
import { SAMPLE_TENDERS } from "./sample-tenders";

/**
 * Tender ingestion source (spec §2.3, §6.1).
 *
 * PRODUCTION uses a real live feed: set `TENDER_FEED_URL` to your tender-data
 * provider's JSON endpoint (BidAssist / Tender247 / data.gov.in / your own
 * crawler output, etc.). Ingestion then pulls REAL tenders — no code change.
 *
 * When `TENDER_FEED_URL` is NOT set, ingestion falls back to a small built-in
 * SAMPLE dataset so dev/demo environments still work. On a configured feed,
 * a fetch/parse failure is surfaced as an error (the ingestion job fails) and
 * we do NOT silently substitute sample data.
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

export function isRealFeedConfigured(): boolean {
  return Boolean(process.env.TENDER_FEED_URL);
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

function sampleAsNormalized(): NormalizedTender[] {
  return SAMPLE_TENDERS.map((t) => {
    const submissionDate = new Date();
    submissionDate.setDate(submissionDate.getDate() + t.daysToDeadline);
    return {
      source: t.source,
      sourceUrl: t.sourceUrl,
      title: t.title,
      department: t.department,
      estimatedValue: t.estimatedValue,
      emd: t.emd,
      submissionDate,
      requirements: t.requirements.map((r) => ({
        requirement: r.requirement,
        mandatory: r.mandatory,
        category: r.category,
      })),
    };
  });
}

/**
 * Resolves the ingestion source. Returns `{ source: "feed" }` with live data
 * when `TENDER_FEED_URL` is set; **throws** on a feed error (so the ingestion
 * job fails visibly rather than polluting a live DB with sample data). Returns
 * `{ source: "sample" }` only when no feed is configured.
 */
export async function fetchTenders(): Promise<{
  source: "feed" | "sample";
  tenders: NormalizedTender[];
}> {
  const url = process.env.TENDER_FEED_URL;
  if (!url) {
    return { source: "sample", tenders: sampleAsNormalized() };
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
