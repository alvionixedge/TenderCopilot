/**
 * One-off cleanup for the CPPP rotating-URL bug: before the fix, every crawl
 * inserted fresh rows (the detail URL embeds a per-fetch timestamp), so the
 * same tender appears many times. This collapses each tender to a single row —
 * keyed on the canonical (timestamp-stripped) URL — keeping the newest, deleting
 * the rest and their dependents, and rewriting the kept row's source_url to the
 * canonical form so future crawls upsert instead of re-inserting.
 *
 *   DATABASE_URL="postgresql://…(direct)…" node scripts/dedupe-tenders.mjs
 */
import postgres from "postgres";

// Mirror of canonicalCpppUrl in src/lib/crawlers/cppp.ts (kept in sync).
function canonical(u) {
  const m = u.indexOf("tendersfullview/");
  if (m === -1) return u;
  const d = u.indexOf("A13h1", m);
  return d === -1 ? u : u.slice(0, d);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (use the DIRECT Neon string).");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false });

try {
  const rows = await sql`SELECT id, source_url, created_at FROM tenders ORDER BY created_at DESC`;
  const groups = new Map(); // canonical URL -> rows (newest first)
  for (const r of rows) {
    const key = canonical(r.source_url);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const dupeIds = [];
  const recanon = []; // kept rows whose source_url still needs canonicalizing
  for (const [key, list] of groups) {
    const keep = list[0];
    if (keep.source_url !== key) recanon.push({ id: keep.id, key });
    for (const r of list.slice(1)) dupeIds.push(r.id);
  }

  console.log(`${rows.length} tender rows → ${groups.size} unique tenders.`);

  if (dupeIds.length > 0) {
    const arr = sql.array(dupeIds);
    console.log(`Removing ${dupeIds.length} duplicate row(s) and dependents…`);
    await sql`DELETE FROM bid_outcomes WHERE opportunity_id IN
                (SELECT id FROM opportunities WHERE tender_id = ANY(${arr}))`;
    await sql`DELETE FROM opportunities WHERE tender_id = ANY(${arr})`;
    await sql`DELETE FROM proposal_versions WHERE proposal_id IN
                (SELECT id FROM proposals WHERE tender_id = ANY(${arr}))`;
    await sql`DELETE FROM proposals WHERE tender_id = ANY(${arr})`;
    await sql`DELETE FROM tender_matches WHERE tender_id = ANY(${arr})`;
    await sql`DELETE FROM tender_requirements WHERE tender_id = ANY(${arr})`;
    await sql`DELETE FROM tender_versions WHERE tender_id = ANY(${arr})`;
    await sql`DELETE FROM tenders WHERE id = ANY(${arr})`;
  }

  // Canonicalize the kept rows AFTER deleting dupes (avoids unique collisions).
  let fixed = 0;
  for (const { id, key } of recanon) {
    await sql`UPDATE tenders SET source_url = ${key} WHERE id = ${id}`;
    fixed++;
  }

  console.log(
    `Done. Removed ${dupeIds.length} duplicate(s); canonicalized ${fixed} kept URL(s). ` +
      `Feed now has ${groups.size} unique tenders.`,
  );
} finally {
  await sql.end();
}
