import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, organizations, subscriptions, users } from "@/db/schema";
import { AccountDanger } from "@/components/account-danger";
import { checkDeletionEligibility } from "@/lib/account";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = (await auth())!;

  const eligibility = await tryQuery(
    () => checkDeletionEligibility(session.userId),
    { canDelete: false, reason: "Deletion is temporarily unavailable." },
  );

  const [org, subscription, members] = await Promise.all([
    tryQuery(
      () =>
        db().query.organizations.findFirst({
          where: eq(organizations.id, session.orgId),
        }),
      null,
    ),
    tryQuery(
      () =>
        db().query.subscriptions.findFirst({
          where: eq(subscriptions.orgId, session.orgId),
        }),
      null,
    ),
    tryQuery(
      () =>
        db()
          .select({
            id: memberships.id,
            role: memberships.role,
            status: memberships.status,
            name: users.name,
            email: users.email,
          })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(eq(memberships.orgId, session.orgId)),
      [],
    ),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Organization, plan and members.</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            ["Name", org?.name ?? "—"],
            ["Type", org?.type ?? "—"],
            ["Plan", org?.plan ?? session.plan],
            ["Subscription", subscription?.status ?? "—"],
            [
              "Trial ends",
              subscription?.trialEndsAt
                ? new Date(subscription.trialEndsAt).toLocaleDateString("en-IN")
                : "—",
            ],
            ["Your role", session.role],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Members</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-slate-800">{m.name}</div>
                <div className="text-xs text-slate-500">{m.email}</div>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold capitalize text-brand-700">
                {m.role}
              </span>
            </li>
          ))}
          {members.length === 0 && (
            <li className="py-3 text-sm text-slate-500">No members found.</li>
          )}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Member invitations ship in the next milestone (spec Section 3.20).
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Policies</h2>
        <p className="mt-1 text-sm text-slate-600">
          How we handle your account and data.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/security" className="font-medium text-brand-700 hover:underline">
            Data &amp; Security Policy
          </Link>
          <Link href="/terms" className="font-medium text-brand-700 hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>

      <AccountDanger canDelete={eligibility.canDelete} deleteBlockedReason={eligibility.reason} />
    </div>
  );
}
