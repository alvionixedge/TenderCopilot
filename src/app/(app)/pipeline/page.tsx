import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { opportunities, tenders } from "@/db/schema";
import { StageMover } from "@/components/actions";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

const STAGES = [
  "DISCOVERED",
  "QUALIFIED",
  "PROPOSAL",
  "REVIEW",
  "SUBMITTED",
  "WON",
  "LOST",
] as const;

const STAGE_TONES: Record<string, string> = {
  DISCOVERED: "border-slate-300",
  QUALIFIED: "border-brand-300",
  PROPOSAL: "border-amber-300",
  REVIEW: "border-purple-300",
  SUBMITTED: "border-sky-300",
  WON: "border-emerald-400",
  LOST: "border-rose-300",
};

export default async function PipelinePage() {
  const session = (await auth())!;

  const rows = await tryQuery(
    () =>
      db()
        .select({
          id: opportunities.id,
          stage: opportunities.stage,
          version: opportunities.version,
          dueDate: opportunities.dueDate,
          tenderId: opportunities.tenderId,
          tenderTitle: tenders.title,
          estimatedValue: tenders.estimatedValue,
        })
        .from(opportunities)
        .innerJoin(tenders, eq(opportunities.tenderId, tenders.id))
        .where(eq(opportunities.orgId, session.orgId)),
    [],
  );

  const byStage = new Map<string, typeof rows>();
  for (const s of STAGES) byStage.set(s, []);
  for (const r of rows) byStage.get(r.stage)?.push(r);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Bid pipeline</h1>
      <p className="mt-1 text-sm text-slate-600">
        Track every bid from discovery to outcome. Recording WON/LOST builds your win/loss
        intelligence over time.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          The pipeline is empty. Add tenders from the{" "}
          <Link href="/tenders" className="font-medium text-brand-700 hover:underline">
            feed
          </Link>{" "}
          with <em>Add to pipeline</em>.
        </div>
      ) : (
        <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage} className="w-64 shrink-0">
              <div
                className={`rounded-t-xl border-t-4 ${STAGE_TONES[stage]} bg-white px-3 py-2 shadow-sm`}
              >
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {stage}
                </span>
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {byStage.get(stage)?.length ?? 0}
                </span>
              </div>
              <div className="min-h-32 space-y-2 rounded-b-xl bg-slate-100/60 p-2">
                {(byStage.get(stage) ?? []).map((o) => (
                  <div
                    key={o.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <Link
                      href={`/tenders/${o.tenderId}`}
                      className="line-clamp-2 text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {o.tenderTitle}
                    </Link>
                    <div className="mt-1.5 text-xs text-slate-500">
                      {o.estimatedValue
                        ? `₹${Number(o.estimatedValue).toLocaleString("en-IN")}`
                        : ""}
                      {o.dueDate &&
                        ` · due ${new Date(o.dueDate).toLocaleDateString("en-IN")}`}
                    </div>
                    <div className="mt-2">
                      <StageMover
                        opportunityId={o.id}
                        version={o.version}
                        currentStage={o.stage}
                        stages={[...STAGES]}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
