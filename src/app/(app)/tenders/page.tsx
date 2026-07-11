import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { tenderMatches, tenders } from "@/db/schema";
import { ScoreBadge, StatusPill } from "@/components/score-badge";
import { AnalyzeButton } from "@/components/actions";
import { getActiveCompany } from "@/lib/tenant";
import { isRealFeedConfigured } from "@/lib/tender-feed";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Tenders" };
export const dynamic = "force-dynamic";

function inr(value: string | null) {
  if (!value) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default async function TendersPage() {
  const session = (await auth())!;
  const company = await tryQuery(() => getActiveCompany(session.orgId), null);

  const rows = await tryQuery(
    () =>
      db()
        .select()
        .from(tenders)
        .where(eq(tenders.status, "open"))
        .orderBy(desc(tenders.createdAt))
        .limit(50),
    [],
  );

  const matchByTender = new Map<
    string,
    { matchScore: number; eligibilityScore: number; winProbability: number | null }
  >();
  if (company && rows.length > 0) {
    const matches = await tryQuery(
      () =>
        db()
          .select()
          .from(tenderMatches)
          .where(
            inArray(
              tenderMatches.tenderId,
              rows.map((r) => r.id),
            ),
          ),
      [],
    );
    for (const m of matches) {
      if (m.companyId === company.id) {
        matchByTender.set(m.tenderId, {
          matchScore: m.matchScore,
          eligibilityScore: m.eligibilityScore,
          winProbability: m.winProbability,
        });
      }
    }
  }

  const ranked = [...rows].sort((a, b) => {
    const ma = matchByTender.get(a.id)?.matchScore ?? -1;
    const mb = matchByTender.get(b.id)?.matchScore ?? -1;
    return mb - ma;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tender feed</h1>
          <p className="mt-1 text-sm text-slate-600">
            Open tenders from GeM, CPPP, state portals and PSUs, ranked for{" "}
            {company ? <strong>{company.companyName}</strong> : "your company"}.
          </p>
        </div>
      </div>

      {!isRealFeedConfigured() && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Sample data.</strong> A live tender source isn&apos;t enabled yet, so these are
          illustrative examples. Set <code className="font-mono text-xs">TENDER_CRAWL_CPPP=true</code>{" "}
          to pull real government tenders directly from eprocure.gov.in (free, no key), or{" "}
          <code className="font-mono text-xs">TENDER_FEED_URL</code> for a provider feed — then run
          the ingestion cron.
        </div>
      )}

      {!company && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Create your{" "}
          <Link href="/company" className="font-semibold underline">
            company profile
          </Link>{" "}
          to unlock match scoring and proposal generation.
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {ranked.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No tenders ingested yet. The ingestion cron populates the feed automatically —
            or trigger it once via <code className="font-mono text-xs">/api/cron/ingest</code>{" "}
            with the CRON_SECRET (see DEPLOYMENT.md).
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ranked.map((t) => {
              const m = matchByTender.get(t.id);
              return (
                <li key={t.id} className="p-5 hover:bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/tenders/${t.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {t.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <StatusPill status={t.status} />
                        <span>{t.source}</span>
                        <span>{t.department}</span>
                        <span>Value {inr(t.estimatedValue)}</span>
                        <span>EMD {inr(t.emd)}</span>
                        {t.submissionDate && (
                          <span className="font-medium text-slate-600">
                            Closes {new Date(t.submissionDate).toLocaleDateString("en-IN")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m ? (
                        <>
                          <ScoreBadge label="Match" value={m.matchScore} />
                          <ScoreBadge label="Eligibility" value={m.eligibilityScore} />
                          <ScoreBadge label="Win" value={m.winProbability} />
                        </>
                      ) : (
                        company && <AnalyzeButton tenderId={t.id} small />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
