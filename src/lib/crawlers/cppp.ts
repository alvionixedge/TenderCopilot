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
const BASE = "https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata";
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

async function fetchPage(page: number): Promise<string> {
  const url = page > 0 ? `${BASE}?page=${page}` : BASE;
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`CPPP page ${page} responded ${res.status} ${res.statusText}`);
  return res.text();
}

/**
 * Crawls the first `maxPages` pages (10 tenders each) of the CPPP latest-active
 * listing. Throws if the first page fails or nothing parses (so the ingestion
 * job fails visibly rather than silently ingesting nothing).
 */
export async function crawlCppp(maxPages = 5): Promise<NormalizedTender[]> {
  const all: NormalizedTender[] = [];
  const seen = new Set<string>();
  for (let p = 0; p < maxPages; p++) {
    let rows: NormalizedTender[];
    try {
      rows = parseCpppListing(await fetchPage(p));
    } catch (err) {
      if (p === 0) throw err; // first page must work
      break; // later-page hiccup: keep what we have
    }
    if (rows.length === 0) break;
    for (const r of rows) {
      if (!seen.has(r.sourceUrl)) {
        seen.add(r.sourceUrl);
        all.push(r);
      }
    }
  }
  if (all.length === 0) {
    throw new Error("CPPP crawl parsed no tenders — the portal markup may have changed.");
  }
  return all;
}
