import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Download, FileText } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { proposals, proposalVersions, tenders } from "@/db/schema";
import { StatusPill } from "@/components/score-badge";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Proposals" };
export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const session = (await auth())!;

  const rows = await tryQuery(
    () =>
      db()
        .select({
          id: proposals.id,
          status: proposals.status,
          currentVersion: proposals.currentVersion,
          createdAt: proposals.createdAt,
          tenderId: proposals.tenderId,
          tenderTitle: tenders.title,
          tenderSource: tenders.source,
        })
        .from(proposals)
        .innerJoin(tenders, eq(proposals.tenderId, tenders.id))
        .where(eq(proposals.orgId, session.orgId))
        .orderBy(desc(proposals.createdAt)),
    [],
  );

  const completenessById = new Map<string, number | null>();
  for (const row of rows) {
    const v = await tryQuery(
      () =>
        db().query.proposalVersions.findFirst({
          where: eq(proposalVersions.proposalId, row.id),
          orderBy: desc(proposalVersions.version),
        }),
      null,
    );
    completenessById.set(row.id, v?.completeness ?? null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
      <p className="mt-1 text-sm text-slate-600">
        AI-generated, compliance-structured bid documents. Download as DOCX and review
        before submission.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              No proposals yet. Open a tender in the{" "}
              <Link href="/tenders" className="font-medium text-brand-700 hover:underline">
                feed
              </Link>{" "}
              and click <em>Generate proposal</em>.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/tenders/${p.tenderId}`}
                    className="font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {p.tenderTitle}
                  </Link>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <StatusPill status={p.status} />
                    <span>{p.tenderSource}</span>
                    <span>Revision v{p.currentVersion}</span>
                    {completenessById.get(p.id) != null && (
                      <span>Completeness {completenessById.get(p.id)}%</span>
                    )}
                    <span>{new Date(p.createdAt).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
                {(p.status === "ready" || p.status === "submitted") && (
                  <a
                    href={`/api/v1/proposals/${p.id}/download`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    <Download className="h-4 w-4" /> Download DOCX
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
