import { notFound } from "next/navigation";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  AlertTriangle,
  Banknote,
  Bot,
  FileText,
  Radar,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  aiGenerations,
  jobs,
  leads,
  organizations,
  paymentEvents,
  proposals,
  subscriptions,
  tenders,
  users,
} from "@/db/schema";
import { isAdminUser } from "@/lib/admin";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Ops" };
export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => n.toLocaleString("en-IN");

async function scalar(q: () => Promise<{ c: number }[]>): Promise<number> {
  const rows = await tryQuery(q, [{ c: 0 }]);
  return rows[0]?.c ?? 0;
}
async function sumRs(q: () => Promise<{ v: string }[]>): Promise<number> {
  const rows = await tryQuery(q, [{ v: "0" }]);
  return Number(rows[0]?.v ?? 0);
}

export default async function AdminOpsPage() {
  const session = (await auth())!;
  if (!isAdminUser(session.user?.email)) notFound();

  const d = () => db();
  const [
    orgs,
    usersTotal,
    signups7,
    leadsTotal,
    leads7,
    planRows,
    paidSubs,
    revenueTotal,
    revenue30,
    refundsTotal,
    paymentsCount,
    aiCount,
    aiInput,
    aiOutput,
    tendersTotal,
    tendersOpen,
    proposalsTotal,
    proposalsReady,
    failedJobs,
    lastIngest,
  ] = await Promise.all([
    scalar(() => d().select({ c: count() }).from(organizations)),
    scalar(() => d().select({ c: count() }).from(users)),
    scalar(() => d().select({ c: count() }).from(users).where(gte(users.createdAt, daysAgo(7)))),
    scalar(() => d().select({ c: count() }).from(leads)),
    scalar(() => d().select({ c: count() }).from(leads).where(gte(leads.createdAt, daysAgo(7)))),
    tryQuery(
      () =>
        d()
          .select({ plan: organizations.plan, c: count() })
          .from(organizations)
          .groupBy(organizations.plan),
      [] as { plan: string; c: number }[],
    ),
    scalar(() =>
      d()
        .select({ c: count() })
        .from(subscriptions)
        .where(
          and(eq(subscriptions.status, "active"), inArray(subscriptions.plan, ["pro", "business"])),
        ),
    ),
    sumRs(() =>
      d()
        .select({ v: sql<string>`coalesce(sum(${paymentEvents.amount}), 0)` })
        .from(paymentEvents)
        .where(eq(paymentEvents.type, "payment")),
    ),
    sumRs(() =>
      d()
        .select({ v: sql<string>`coalesce(sum(${paymentEvents.amount}), 0)` })
        .from(paymentEvents)
        .where(and(eq(paymentEvents.type, "payment"), gte(paymentEvents.createdAt, daysAgo(30)))),
    ),
    sumRs(() =>
      d()
        .select({ v: sql<string>`coalesce(sum(${paymentEvents.amount}), 0)` })
        .from(paymentEvents)
        .where(eq(paymentEvents.type, "refund")),
    ),
    scalar(() =>
      d().select({ c: count() }).from(paymentEvents).where(eq(paymentEvents.type, "payment")),
    ),
    scalar(() => d().select({ c: count() }).from(aiGenerations)),
    sumRs(() =>
      d().select({ v: sql<string>`coalesce(sum(${aiGenerations.inputTokens}), 0)` }).from(aiGenerations),
    ),
    sumRs(() =>
      d()
        .select({ v: sql<string>`coalesce(sum(${aiGenerations.outputTokens}), 0)` })
        .from(aiGenerations),
    ),
    scalar(() => d().select({ c: count() }).from(tenders)),
    scalar(() => d().select({ c: count() }).from(tenders).where(eq(tenders.status, "open"))),
    scalar(() => d().select({ c: count() }).from(proposals)),
    scalar(() =>
      d().select({ c: count() }).from(proposals).where(inArray(proposals.status, ["ready", "submitted"])),
    ),
    scalar(() =>
      d().select({ c: count() }).from(jobs).where(inArray(jobs.status, ["failed", "dead_letter"])),
    ),
    tryQuery(
      () =>
        d()
          .select({ status: jobs.status, updatedAt: jobs.updatedAt })
          .from(jobs)
          .where(eq(jobs.type, "ingest"))
          .orderBy(desc(jobs.createdAt))
          .limit(1),
      [] as { status: string; updatedAt: Date }[],
    ),
  ]);

  const planCount = (p: string) => planRows.find((r) => r.plan === p)?.c ?? 0;
  // Haiku 4.5 pricing: $1 / 1M input, $5 / 1M output. ~₹85/USD (approx).
  const aiCostUsd = (aiInput / 1e6) * 1 + (aiOutput / 1e6) * 5;
  const aiCostInr = aiCostUsd * 85;
  const ingest = lastIngest[0];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-brand-600" />
        <h1 className="text-2xl font-bold text-slate-900">Ops dashboard</h1>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        Platform-wide metrics across all organizations. Visible only to allow-listed admins.
      </p>

      <Section title="Growth" icon={Users}>
        <Stat label="Organizations" value={num(orgs)} />
        <Stat label="Users" value={num(usersTotal)} />
        <Stat label="Signups (7d)" value={num(signups7)} accent />
        <Stat label="Leads (total)" value={num(leadsTotal)} />
        <Stat label="Leads (7d)" value={num(leads7)} accent />
      </Section>

      <Section title="Revenue" icon={Banknote}>
        <Stat label="Total captured" value={inr(revenueTotal)} accent />
        <Stat label="Last 30 days" value={inr(revenue30)} />
        <Stat label="Payments" value={num(paymentsCount)} />
        <Stat label="Refunds" value={inr(refundsTotal)} />
        <Stat label="Active paid subs" value={num(paidSubs)} />
      </Section>

      <Section title="Plans" icon={TrendingUp}>
        <Stat label="Free" value={num(planCount("free"))} />
        <Stat label="Pro" value={num(planCount("pro"))} accent />
        <Stat label="Business" value={num(planCount("business"))} accent />
      </Section>

      <Section title="AI usage & cost" icon={Bot}>
        <Stat label="Generations" value={num(aiCount)} />
        <Stat label="Input tokens" value={num(aiInput)} />
        <Stat label="Output tokens" value={num(aiOutput)} />
        <Stat label="Est. AI cost" value={inr(aiCostInr)} sub={`~$${aiCostUsd.toFixed(2)}`} />
      </Section>

      <Section title="Product" icon={FileText}>
        <Stat label="Tenders (open)" value={num(tendersOpen)} sub={`${num(tendersTotal)} total`} />
        <Stat label="Proposals" value={num(proposalsTotal)} sub={`${num(proposalsReady)} ready`} />
      </Section>

      <Section title="System health" icon={Radar}>
        <Stat
          label="Failed jobs"
          value={num(failedJobs)}
          danger={failedJobs > 0}
        />
        <Stat
          label="Last ingestion"
          value={ingest ? ingest.status : "never"}
          sub={ingest ? new Date(ingest.updatedAt).toLocaleString("en-IN") : "run the cron"}
          danger={ingest?.status === "failed"}
        />
        <Stat label="Deploy" value={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev"} />
      </Section>

      <p className="mt-8 flex items-center gap-2 text-xs text-slate-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        Estimates (AI cost) are indicative. For infra depth (deploys, DB storage, settlements) use
        each provider&apos;s own dashboard — see the README.
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4.5 w-4.5 text-slate-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        danger ? "border-rose-200 bg-rose-50" : accent ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-bold ${danger ? "text-rose-700" : accent ? "text-brand-800" : "text-slate-900"}`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
