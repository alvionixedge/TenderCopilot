import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { ArrowRight, Building2, FileText, Radar, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { bidOutcomes, proposals, tenderMatches, tenders } from "@/db/schema";
import { ScoreBadge } from "@/components/score-badge";
import { getActiveCompany } from "@/lib/tenant";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = (await auth())!;
  const orgId = session.orgId;

  const company = await tryQuery(() => getActiveCompany(orgId), null);

  const [openTenders, matchCount, proposalCount, wonCount, recentMatches] = await Promise.all([
    tryQuery(
      async () =>
        (await db().select({ c: count() }).from(tenders).where(eq(tenders.status, "open")))[0].c,
      0,
    ),
    tryQuery(
      async () =>
        (
          await db()
            .select({ c: count() })
            .from(tenderMatches)
            .where(eq(tenderMatches.orgId, orgId))
        )[0].c,
      0,
    ),
    tryQuery(
      async () =>
        (await db().select({ c: count() }).from(proposals).where(eq(proposals.orgId, orgId)))[0]
          .c,
      0,
    ),
    tryQuery(
      async () =>
        (
          await db()
            .select({ c: count() })
            .from(bidOutcomes)
            .where(and(eq(bidOutcomes.orgId, orgId), eq(bidOutcomes.result, "WON")))
        )[0].c,
      0,
    ),
    tryQuery(
      () =>
        db()
          .select({
            tenderId: tenders.id,
            title: tenders.title,
            source: tenders.source,
            submissionDate: tenders.submissionDate,
            matchScore: tenderMatches.matchScore,
            eligibilityScore: tenderMatches.eligibilityScore,
            winProbability: tenderMatches.winProbability,
          })
          .from(tenderMatches)
          .innerJoin(tenders, eq(tenderMatches.tenderId, tenders.id))
          .where(eq(tenderMatches.orgId, orgId))
          .orderBy(desc(tenderMatches.matchScore))
          .limit(5),
      [],
    ),
  ]);

  const stats = [
    { label: "Open tenders", value: openTenders, icon: Radar, href: "/tenders" },
    { label: "Scored matches", value: matchCount, icon: Building2, href: "/tenders" },
    { label: "Proposals", value: proposalCount, icon: FileText, href: "/proposals" },
    { label: "Bids won", value: wonCount, icon: Trophy, href: "/pipeline" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome back{session.user?.name ? `, ${session.user.name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Here&apos;s what&apos;s happening across your bid pipeline.
      </p>

      {!company && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-lg font-semibold text-brand-900">
            Start by creating your company profile
          </h2>
          <p className="mt-1 text-sm text-brand-800">
            Your profile (GSTIN, turnover, capabilities) powers tender matching, eligibility
            scoring and proposal generation.
          </p>
          <Link
            href="/company"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Create company profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <s.icon className="h-5 w-5 text-brand-600" />
            <div className="mt-3 text-3xl font-bold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Top matches</h2>
          <Link href="/tenders" className="text-sm font-medium text-brand-700 hover:underline">
            View all tenders →
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {recentMatches.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No scored matches yet. Open{" "}
              <Link href="/tenders" className="font-medium text-brand-700 hover:underline">
                Tenders
              </Link>{" "}
              and analyze one against your profile.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMatches.map((m) => (
                <li key={m.tenderId}>
                  <Link
                    href={`/tenders/${m.tenderId}`}
                    className="flex flex-col gap-2 p-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{m.title}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {m.source} ·{" "}
                        {m.submissionDate
                          ? `closes ${new Date(m.submissionDate).toLocaleDateString("en-IN")}`
                          : "no deadline"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ScoreBadge label="Match" value={m.matchScore} />
                      <ScoreBadge label="Eligibility" value={m.eligibilityScore} />
                      <ScoreBadge label="Win" value={m.winProbability} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
