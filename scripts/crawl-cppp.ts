/**
 * External CPPP crawler — runs in a scheduled GitHub Action (clean IP, longer
 * runtime, free), NOT on Vercel. It crawls the eprocure.gov.in "latest active
 * tenders" listing, optionally enriches each tender's value/EMD/requirements
 * by rendering its (JS-only) detail page with Playwright, then POSTs the
 * results to the app's secured ingestion endpoint.
 *
 * Run: `npx tsx scripts/crawl-cppp.ts`
 * Env: APP_URL, CRON_SECRET (required); TENDER_CRAWL_PAGES,
 *      TENDER_CRAWL_ENRICH, TENDER_CRAWL_ENRICH_LIMIT (optional).
 */
import { crawlCppp, extractDetailFields } from "../src/lib/crawlers/cppp";

async function main() {
  const APP_URL = process.env.APP_URL;
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!APP_URL || !CRON_SECRET) {
    console.error("APP_URL and CRON_SECRET are required.");
    process.exit(1);
  }
  const pages = Math.max(1, Math.min(20, Number(process.env.TENDER_CRAWL_PAGES) || 10));
  const enrich = process.env.TENDER_CRAWL_ENRICH === "true";
  const enrichLimit = Math.max(0, Number(process.env.TENDER_CRAWL_ENRICH_LIMIT) || 25);

  const tenders = await crawlCppp(pages);
  console.log(`Crawled ${tenders.length} tenders from CPPP (${pages} pages).`);

  if (enrich && enrichLimit > 0) {
    // Dynamic import so Playwright is only needed when enrichment is enabled.
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let done = 0;
    for (const t of tenders.slice(0, enrichLimit)) {
      try {
        await page.goto(t.sourceUrl, { waitUntil: "networkidle", timeout: 30000 });
        const text = await page.innerText("body");
        const f = extractDetailFields(text);
        if (f.estimatedValue != null) t.estimatedValue = f.estimatedValue;
        if (f.emd != null) t.emd = f.emd;
        if (f.requirements.length > 0) t.requirements = f.requirements;
        done++;
      } catch (e) {
        console.warn(`  enrich failed: ${t.sourceUrl} — ${String(e).slice(0, 120)}`);
      }
    }
    await browser.close();
    console.log(`Enriched ${done}/${Math.min(enrichLimit, tenders.length)} detail pages.`);
  }

  const payload = {
    source: "cppp",
    tenders: tenders.map((t) => ({
      source: t.source,
      sourceUrl: t.sourceUrl,
      title: t.title,
      department: t.department,
      estimatedValue: t.estimatedValue,
      emd: t.emd,
      submissionDate: t.submissionDate ? t.submissionDate.toISOString() : null,
      requirements: t.requirements,
    })),
  };

  const res = await fetch(`${APP_URL.replace(/\/$/, "")}/api/v1/tenders/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${CRON_SECRET}` },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Ingest failed (${res.status}): ${body}`);
    process.exit(1);
  }
  console.log(`Ingest OK: ${body}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
