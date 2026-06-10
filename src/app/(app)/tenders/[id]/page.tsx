import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, CircleAlert } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { tenderMatches, tenderRequirements, tenders } from "@/db/schema";
import { ScoreBadge, StatusPill } from "@/components/score-badge";
import {
  AddToPipelineButton,
  AnalyzeButton,
  GenerateProposalButton,
} from "@/components/actions";
import { getActiveCompany } from "@/lib/tenant";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Tender detail" };
export const dynamic = "force-dynamic";

function inr(value: string | null) {
  if (!value) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = (await auth())!;
  const { id } = await params;

  const tender = await tryQuery(
    () => db().query.tenders.findFirst({ where: eq(tenders.id, id) }),
    null,
  );
  if (!tender) notFound();

  const company = await tryQuery(() => getActiveCompany(session.orgId), null);

  const [requirements, match] = await Promise.all([
    tryQuery(
      () =>
        db()
          .select()
          .from(tenderRequirements)
          .where(
            and(
              eq(tenderRequirements.tenderId, tender.id),
              eq(tenderRequirements.tenderVersion, tender.currentVersion),
            ),
          ),
      [],
    ),
    company
      ? tryQuery(
          () =>
            db().query.tenderMatches.findFirst({
              where: and(
                eq(tenderMatches.tenderId, tender.id),
                eq(tenderMatches.tenderVersion, tender.currentVersion),
                eq(tenderMatches.companyId, company.id),
                eq(tenderMatches.orgId, session.orgId),
              ),
            }),
          null,
        )
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/tenders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={tender.status} />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {tender.source}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">{tender.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{tender.department}</p>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Estimated value", inr(tender.estimatedValue)],
            ["EMD", inr(tender.emd)],
            [
              "Submission deadline",
              tender.submissionDate
                ? new Date(tender.submissionDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—",
            ],
            ["Version", `v${tender.currentVersion}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="mt-1 font-semibold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          {company ? (
            <>
              <AnalyzeButton tenderId={tender.id} />
              <GenerateProposalButton tenderId={tender.id} />
              <AddToPipelineButton tenderId={tender.id} />
            </>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <Link href="/company" className="font-semibold underline">
                Create your company profile
              </Link>{" "}
              to analyze and bid on this tender.
            </div>
          )}
        </div>
      </div>

      {match && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fit assessment</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreBadge label="Match" value={match.matchScore} />
            <ScoreBadge label="Eligibility" value={match.eligibilityScore} />
            <ScoreBadge label="Win probability" value={match.winProbability} />
          </div>
          {match.reasoning && (
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">
              {match.reasoning}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Extracted requirements{" "}
          <span className="text-sm font-normal text-slate-500">({requirements.length})</span>
        </h2>
        {requirements.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No requirements extracted yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {requirements.map((r) => (
              <li key={r.id} className="flex items-start gap-3">
                {r.mandatory ? (
                  <CircleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-500" />
                )}
                <div>
                  <span className="text-sm text-slate-800">{r.requirement}</span>
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                    {r.mandatory ? "Mandatory" : "Optional"}
                    {r.category ? ` · ${r.category}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
