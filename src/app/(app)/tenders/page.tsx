import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { tenderMatches, tenders } from "@/db/schema";
import { ScoreBadge, StatusPill } from "@/components/score-badge";
import { AnalyzeButton } from "@/components/actions";
import { getActiveCompany } from "@/lib/tenant";
import { missingRequiredProfileFields } from "@/lib/company-profile";
import { fitsProfile, tenderRelevance } from "@/lib/tender-filter";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Tenders" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const MAX_OPEN = 3000; // working set cap for in-memory relevance filtering

function inr(value: string | null) {
  if (!value) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default async function TendersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; all?: string }>;
}) {
  const session = (await auth())!;
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const company = await tryQuery(() => getActiveCompany(session.orgId), null);
  const missing = missingRequiredProfileFields(company);

  // --- Profile gate: the feed is filtered to your profile, so it requires a
  // complete-enough profile before showing anything. ---
  if (missing.length > 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-slate-900">Tender feed</h1>
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">
            Complete your company profile to see matched tenders
          </h2>
          <p className="mt-2 text-sm text-amber-800">
            We filter the live feed to tenders that fit your company, so these fields are
            required first:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {missing.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-amber-500">•</span>
                <strong>{f}</strong>
              </li>
            ))}
          </ul>
          <Link
            href={company ? "/company?edit=1" : "/company"}
            className="mt-5 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {company ? "Add these details" : "Create company profile"}
          </Link>
        </div>
      </div>
    );
  }

  // company is guaranteed non-null here (missing would include everything otherwise)
  const profile = company!;

  const allOpen = await tryQuery(
    () =>
      db()
        .select()
        .from(tenders)
        .where(eq(tenders.status, "open"))
        .orderBy(desc(tenders.createdAt))
        .limit(MAX_OPEN),
    [],
  );

  // Score every open tender against the profile, then filter unless "Show all".
  const scored = allOpen
    .map((t) => ({ t, relevance: tenderRelevance(profile, t), fits: fitsProfile(profile, t) }))
    .sort((a, b) => b.relevance - a.relevance);

  const matchedCount = scored.filter((s) => s.fits).length;
  const hiddenCount = allOpen.length - matchedCount;
  const visible = showAll ? scored : scored.filter((s) => s.fits);

  const totalVisible = visible.length;
  const totalPages = Math.max(1, Math.ceil(totalVisible / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), totalPages);
  const offset = (page - 1) * PAGE_SIZE;
  const pageRows = visible.slice(offset, offset + PAGE_SIZE).map((s) => s.t);

  const matchByTender = new Map<
    string,
    { matchScore: number; eligibilityScore: number; winProbability: number | null }
  >();
  if (pageRows.length > 0) {
    const matches = await tryQuery(
      () =>
        db()
          .select()
          .from(tenderMatches)
          .where(
            inArray(
              tenderMatches.tenderId,
              pageRows.map((r) => r.id),
            ),
          ),
      [],
    );
    for (const m of matches) {
      if (m.companyId === profile.id) {
        matchByTender.set(m.tenderId, {
          matchScore: m.matchScore,
          eligibilityScore: m.eligibilityScore,
          winProbability: m.winProbability,
        });
      }
    }
  }

  const hrefFor = (p: number) => `/tenders?page=${p}${showAll ? "&all=1" : ""}`;

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tender feed</h1>
        <p className="mt-1 text-sm text-slate-600">
          Open tenders from CPPP, state portals and PSUs, matched to{" "}
          <strong>{profile.companyName}</strong> by capability and turnover.
        </p>
      </div>

      {/* Filter status + Show all / matched toggle */}
      <div className="mt-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        {showAll ? (
          <span className="text-slate-700">
            Showing <strong>all {allOpen.length.toLocaleString("en-IN")}</strong> open tenders
            (unfiltered).
          </span>
        ) : (
          <span className="text-slate-700">
            <strong>{matchedCount.toLocaleString("en-IN")}</strong> tenders match your profile
            {hiddenCount > 0 && (
              <>
                {" "}
                · <span className="text-slate-500">{hiddenCount.toLocaleString("en-IN")} hidden as a weak fit</span>
              </>
            )}
          </span>
        )}
        {showAll ? (
          <Link
            href="/tenders"
            className="shrink-0 font-semibold text-brand-700 hover:underline"
          >
            Show matched only
          </Link>
        ) : (
          <Link
            href="/tenders?all=1"
            className="shrink-0 font-semibold text-brand-700 hover:underline"
          >
            Show all {allOpen.length.toLocaleString("en-IN")} tenders →
          </Link>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {allOpen.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No tenders ingested yet. The ingestion cron populates the feed automatically —
            or trigger it once via <code className="font-mono text-xs">/api/cron/ingest</code>{" "}
            with the CRON_SECRET (see DEPLOYMENT.md).
          </div>
        ) : pageRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            None of the {allOpen.length.toLocaleString("en-IN")} open tenders match your
            profile right now. Try{" "}
            <Link href="/tenders?all=1" className="font-semibold text-brand-700 hover:underline">
              showing all tenders
            </Link>{" "}
            or broaden your capability statement.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pageRows.map((t) => {
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
                        {t.msmeReserved && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700">
                            MSME reserved
                          </span>
                        )}
                        {t.minEmployees != null && (
                          <span>Min staff {t.minEmployees}</span>
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
                        <AnalyzeButton tenderId={t.id} small />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
          <span>
            Showing {(offset + 1).toLocaleString("en-IN")}–
            {Math.min(offset + PAGE_SIZE, totalVisible).toLocaleString("en-IN")} of{" "}
            {totalVisible.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={hrefFor(page - 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                ← Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-400">
                ← Previous
              </span>
            )}
            <span className="px-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={hrefFor(page + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
              >
                Next →
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-400">
                Next →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
