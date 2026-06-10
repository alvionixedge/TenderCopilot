/**
 * Idempotent seed: plan entitlements (spec 3.18) + initial tender feed.
 * Run once after the first deploy: DATABASE_URL=... npm run db:seed
 * (Safe to re-run: every insert is ON CONFLICT DO NOTHING/UPDATE.)
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required. Example:");
  console.error('  DATABASE_URL="postgresql://..." npm run db:seed');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const planFeatures = [
  ["free", "proposals_per_month", 3, "month"],
  ["free", "tenders_per_day", 20, "day"],
  ["free", "seats", 1, "total"],
  ["free", "companies", 1, "total"],
  ["pro", "proposals_per_month", 25, "month"],
  ["pro", "tenders_per_day", 200, "day"],
  ["pro", "seats", 5, "total"],
  ["pro", "companies", 3, "total"],
  ["business", "proposals_per_month", null, "month"],
  ["business", "tenders_per_day", null, "day"],
  ["business", "seats", 25, "total"],
  ["business", "companies", 25, "total"],
];

try {
  for (const [plan, key, limit, period] of planFeatures) {
    await sql`
      INSERT INTO plan_features (plan, feature_key, limit_value, period)
      VALUES (${plan}, ${key}, ${limit}, ${period})
      ON CONFLICT (plan, feature_key) DO UPDATE SET limit_value = ${limit}, period = ${period}
    `;
  }
  console.log(`[seed] plan_features upserted (${planFeatures.length} rows).`);
  console.log(
    "[seed] done. Trigger /api/cron/ingest (with CRON_SECRET) to populate the tender feed.",
  );
} finally {
  await sql.end();
}
