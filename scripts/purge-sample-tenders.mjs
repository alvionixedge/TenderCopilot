/**
 * One-off cleanup: remove the old built-in SAMPLE tenders (and their dependent
 * rows) from a database that was seeded before live ingestion was enabled.
 * Targets ONLY the 10 known sample source URLs — real CPPP/feed tenders (whose
 * URLs contain `/cppp/tendersfullview/` or come from your provider) are left
 * untouched.
 *
 *   DATABASE_URL="postgresql://…(direct)…" node scripts/purge-sample-tenders.mjs
 */
import postgres from "postgres";

const SAMPLE_URLS = [
  "https://gem.gov.in/tenders/GEM-2026-B-100001",
  "https://eprocure.gov.in/cppp/tenders/2026_DoT_754321",
  "https://gem.gov.in/tenders/GEM-2026-B-100417",
  "https://tenders.karnataka.gov.in/2026/KPWD-65432",
  "https://etenders.bhel.in/2026/BHEL-SCT-88991",
  "https://eprocure.gov.in/cppp/tenders/2026_MoHFW_991234",
  "https://gem.gov.in/tenders/GEM-2026-B-100892",
  "https://mahatenders.gov.in/2026/ZP-PUNE-44781",
  "https://tenders.ntpc.co.in/2026/NTPC-IT-55320",
  "https://gem.gov.in/tenders/GEM-2026-B-101244",
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required (use the DIRECT Neon string).');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

try {
  const ids = (
    await sql`SELECT id FROM tenders WHERE source_url = ANY(${sql.array(SAMPLE_URLS)})`
  ).map((r) => r.id);

  if (ids.length === 0) {
    console.log("No sample tenders found — nothing to purge.");
  } else {
    console.log(`Found ${ids.length} sample tender(s). Removing them and dependents…`);
    // Children first (FK-safe). bid_outcomes -> opportunities; proposal_versions -> proposals.
    await sql`DELETE FROM bid_outcomes WHERE opportunity_id IN
                (SELECT id FROM opportunities WHERE tender_id = ANY(${sql.array(ids)}))`;
    await sql`DELETE FROM opportunities WHERE tender_id = ANY(${sql.array(ids)})`;
    await sql`DELETE FROM proposal_versions WHERE proposal_id IN
                (SELECT id FROM proposals WHERE tender_id = ANY(${sql.array(ids)}))`;
    await sql`DELETE FROM proposals WHERE tender_id = ANY(${sql.array(ids)})`;
    await sql`DELETE FROM tender_matches WHERE tender_id = ANY(${sql.array(ids)})`;
    await sql`DELETE FROM tender_requirements WHERE tender_id = ANY(${sql.array(ids)})`;
    await sql`DELETE FROM tender_versions WHERE tender_id = ANY(${sql.array(ids)})`;
    await sql`DELETE FROM tenders WHERE id = ANY(${sql.array(ids)})`;
    console.log(`Purged ${ids.length} sample tender(s) and their dependent rows.`);
  }
} finally {
  await sql.end();
}
