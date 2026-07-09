import Link from "next/link";
import { eq } from "drizzle-orm";
import { Check, CreditCard } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizations, paymentEvents, subscriptions } from "@/db/schema";
import { CancelButton } from "@/components/cancel-button";
import { UpgradeButton } from "@/components/upgrade-button";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { PAID_PLANS, PLANS, razorpayPlanIdFor, type PlanId } from "@/lib/plans";
import { tryQuery } from "@/lib/safe";
import { desc } from "drizzle-orm";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = (await auth())!;
  const canManage = session.role === "owner" || session.role === "admin";

  const [org, subscription, payments] = await Promise.all([
    tryQuery(
      () => db().query.organizations.findFirst({ where: eq(organizations.id, session.orgId) }),
      null,
    ),
    tryQuery(
      () => db().query.subscriptions.findFirst({ where: eq(subscriptions.orgId, session.orgId) }),
      null,
    ),
    tryQuery(
      () =>
        db()
          .select()
          .from(paymentEvents)
          .where(eq(paymentEvents.orgId, session.orgId))
          .orderBy(desc(paymentEvents.createdAt))
          .limit(10),
      [],
    ),
  ]);

  const currentPlan = (org?.plan ?? "free") as PlanId;
  const billingReady = isRazorpayConfigured();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Billing &amp; plan</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pay with UPI, cards or netbanking via Razorpay. Pay once for a month, or subscribe
        for automatic monthly billing.
      </p>

      {/* Current plan */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Current plan</div>
          <div className="mt-1 text-2xl font-bold capitalize text-slate-900">
            {currentPlan} {currentPlan !== "free" && <span className="text-base font-normal text-slate-500">· ₹{PLANS[currentPlan].amountInr.toLocaleString("en-IN")}/mo</span>}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Status: <span className="font-medium capitalize">{subscription?.status ?? "free"}</span>
            {subscription?.currentPeriodEnd && (
              <>
                {" "}
                · {subscription?.cancelAtPeriodEnd ? "access until" : "renews/expires"}{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-IN")}
              </>
            )}
          </div>
          {currentPlan !== "free" && subscription?.cancelAtPeriodEnd && (
            <div className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              Cancels at period end — no further charges
            </div>
          )}
          {currentPlan !== "free" && canManage && !subscription?.cancelAtPeriodEnd && (
            <div className="mt-3">
              <CancelButton />
            </div>
          )}
        </div>
        <CreditCard className="h-10 w-10 text-brand-600" />
      </div>

      {!billingReady && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Payments are not configured for this environment yet. Set{" "}
          <code className="font-mono text-xs">RAZORPAY_KEY_ID</code> and{" "}
          <code className="font-mono text-xs">RAZORPAY_KEY_SECRET</code> (and the webhook
          secret) in Vercel to enable upgrades. See DEPLOYMENT.md.
        </div>
      )}

      {!canManage && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Only an organization owner or admin can change the plan.
        </div>
      )}

      {/* Plan options */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {PAID_PLANS.map((planId) => {
          const def = PLANS[planId];
          const isCurrent = currentPlan === planId;
          const recurringConfigured = Boolean(razorpayPlanIdFor(planId));
          return (
            <div
              key={planId}
              className={`rounded-2xl border p-6 shadow-sm ${
                isCurrent ? "border-brand-600 ring-1 ring-brand-200" : "border-slate-200"
              } bg-white`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-slate-900">{def.name}</h2>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-900">
                    ₹{def.amountInr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-slate-500">/mo</span>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-600">{def.blurb}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {def.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-2">
                {isCurrent ? (
                  <div className="rounded-lg bg-brand-50 px-4 py-2 text-center text-sm font-semibold text-brand-700">
                    Your current plan
                  </div>
                ) : billingReady && canManage ? (
                  <>
                    <UpgradeButton
                      plan={planId}
                      mode="recurring"
                      label={
                        recurringConfigured
                          ? `Subscribe — ₹${def.amountInr.toLocaleString("en-IN")}/mo auto`
                          : "Subscribe (not configured)"
                      }
                      userEmail={session.user?.email}
                      variant="solid"
                    />
                    <UpgradeButton
                      plan={planId}
                      mode="once"
                      label={`Pay once — 1 month`}
                      userEmail={session.user?.email}
                      variant="outline"
                    />
                  </>
                ) : (
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
                  >
                    Upgrade unavailable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                    {p.type}
                  </span>
                  <span className="capitalize text-slate-500">{p.status}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-900">
                    ₹{Number(p.amount).toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(p.createdAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Cancel anytime — you won&apos;t be charged again and keep access until the period you&apos;ve
        paid for ends; amounts already paid are non-refundable. See our{" "}
        <Link href="/refunds" className="font-medium text-brand-700 hover:underline">
          Refund &amp; Cancellation Policy
        </Link>
        . GST tax-invoice generation (spec §3.23) is on the roadmap; receipts are available from
        Razorpay in the meantime.
      </p>
    </div>
  );
}
