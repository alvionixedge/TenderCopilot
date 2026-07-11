import { parse } from "node-html-parser";
import type { NormalizedTender } from "../tender-feed";

/**
 * Direct crawler for the Central Public Procurement Portal (CPPP / eProcure),
 * eprocure.gov.in — the government's own aggregate of central, state and PSU
 * tenders. The "latest active tenders" listing is public, server-rendered
 * HTML (no login, no API key, no CAPTCHA on the browse view), paginated via
 * `?page=N`. This gives real live tenders for free.
 *
 * Fragility note: this parses HTML, so a markup change on eprocure.gov.in can
 * break it — `parseCpppListing` is isolated and unit-tested for that reason.
 */
const ROOT = "https://eprocure.gov.in/cppp";
// CPPP sibling listings that share the same parseable table. `latestactivetendersnew`
// is the main feed (central + state + PSU); high-value and global add coverage.
const LISTINGS = ["latestactivetendersnew", "highvaluetenders", "globaltenders"];
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses "27-Jul-2026 06:00 PM" into a Date (UTC-naive). */
export function parseCpppDate(s: string): Date | null {
  const m = s
    .trim()
    .match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (!m) return null;
  const [, dd, mon, yyyy, hh, min, ap] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month === undefined) return null;
  let hour = hh ? Number(hh) : 0;
  if (ap) {
    const upper = ap.toUpperCase();
    if (upper === "PM" && hour !== 12) hour += 12;
    if (upper === "AM" && hour === 12) hour = 0;
  }
  const d = new Date(Date.UTC(Number(yyyy), month, Number(dd), hour, min ? Number(min) : 0));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Pure parser: given the CPPP listing HTML, returns normalized tenders.
 * Columns: Sl.No | e-Published | Bid Submission Closing | Tender Opening |
 * Title/Ref/Id | Organisation | Corrigendum. Each row links to a
 * `tendersfullview` detail URL (unique — used as sourceUrl).
 */
export function parseCpppListing(html: string): NormalizedTender[] {
  const root = parse(html);
  const out: NormalizedTender[] = [];
  const seen = new Set<string>();
  for (const tr of root.querySelectorAll("tr")) {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 7) continue;
    const link = tr
      .querySelector('a[href*="tendersfullview"]')
      ?.getAttribute("href")
      ?.trim();
    if (!link || seen.has(link)) continue;

    const clean = (s: string) => s.replace(/\s+/g, " ").trim();
    const title = clean(tds[4].text).slice(0, 500);
    if (!title) continue;
    seen.add(link);
    out.push({
      source: "CPPP",
      sourceUrl: link,
      title,
      department: clean(tds[5].text) || null,
      estimatedValue: null, // not shown on the listing; enriched later if needed
      emd: null,
      submissionDate: parseCpppDate(clean(tds[2].text)),
      requirements: [],
    });
  }
  return out;
}

export interface DetailFields {
  estimatedValue: number | null;
  emd: number | null;
  requirements: { requirement: string; mandatory: boolean; category: string | null }[];
}

/**
 * Best-effort extraction of value / EMD / a work-description requirement from a
 * CPPP detail page's **rendered** visible text (the detail page is JS-rendered,
 * so this runs on text produced by a headless browser in the external crawler).
 * Returns nulls when a field isn't found — enrichment never blocks ingestion.
 */
export function extractDetailFields(text: string): DetailFields {
  const t = text.replace(/\s+/g, " ");
  const money = (label: RegExp): number | null => {
    const m = t.match(label);
    if (!m) return null;
    const n = Number(m[1].replace(/[,₹\s]/g, ""));
    return isNaN(n) || n <= 0 ? null : n;
  };
  const estimatedValue = money(
    /Tender\s*Value[^0-9₹]{0,25}(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
  );
  const emd = money(
    /EMD(?:\s*(?:Amount|Fee))?[^0-9₹]{0,25}(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
  );
  const requirements: DetailFields["requirements"] = [];
  const wd = t.match(
    /Work\s*Description[:\s-]*([^]{8,400}?)(?:\s*(?:Tender Fee|EMD|Bid Details|Critical Date|Payment Mode)|$)/i,
  );
  if (wd && wd[1].trim().length > 8) {
    requirements.push({ requirement: wd[1].trim().slice(0, 500), mandatory: true, category: null });
  }
  return { estimatedValue, emd, requirements };
}

async function fetchListingPage(listing: string, page: number): Promise<string> {
  const base = `${ROOT}/${listing}/cpppdata`;
  const url = page > 0 ? `${base}?page=${page}` : base;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`CPPP ${listing} p${page} responded ${res.status} ${res.statusText}`);
  return res.text();
}

/**
 * Crawls CPPP (central + state + PSU aggregator): `maxPages` of the main
 * latest-active listing plus a couple of pages each of the high-value and
 * global listings, deduped by detail URL. Throws only if the main listing's
 * first page fails or nothing parses at all (so the job fails visibly).
 */
export async function crawlCppp(maxPages = 5): Promise<NormalizedTender[]> {
  const all: NormalizedTender[] = [];
  const seen = new Set<string>();

  for (const listing of LISTINGS) {
    const isMain = listing === "latestactivetendersnew";
    const pages = isMain ? maxPages : Math.min(2, maxPages);
    for (let p = 0; p < pages; p++) {
      let rows: NormalizedTender[];
      try {
        rows = parseCpppListing(await fetchListingPage(listing, p));
      } catch (err) {
        if (isMain && p === 0) throw err; // the main listing's first page must work
        break; // a sibling/later-page hiccup: keep what we have
      }
      if (rows.length === 0) break;
      for (const r of rows) {
        if (!seen.has(r.sourceUrl)) {
          seen.add(r.sourceUrl);
          all.push(r);
        }
      }
    }
  }

  if (all.length === 0) {
    throw new Error("CPPP crawl parsed no tenders — the portal markup may have changed.");
  }
  return all;
}
