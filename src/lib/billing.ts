import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, paymentEvents, subscriptions } from "@/db/schema";
import type { PlanId } from "./plans";

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Activates / extends a paid plan for an org (spec §3.17). Updates both
 * organizations.plan (the live entitlement source) and the subscriptions
 * row. Idempotent on org_id.
 */
export async function activatePlan(
  orgId: string,
  plan: PlanId,
  opts: {
    status?: string;
    periodStart?: Date;
    periodEnd?: Date | null;
    razorpaySubscriptionId?: string | null;
    razorpayCustomerId?: string | null;
  } = {},
): Promise<void> {
  const d = db();
  const now = opts.periodStart ?? new Date();
  const status = opts.status ?? "active";

  await d.update(organizations).set({ plan }).where(eq(organizations.id, orgId));

  await d
    .insert(subscriptions)
    .values({
      orgId,
      plan,
      status,
      currentPeriodStart: now,
      currentPeriodEnd: opts.periodEnd ?? null,
      razorpaySubscriptionId: opts.razorpaySubscriptionId ?? null,
      razorpayCustomerId: opts.razorpayCustomerId ?? null,
    })
    .onConflictDoUpdate({
      target: subscriptions.orgId,
      set: {
        plan,
        status,
        currentPeriodStart: now,
        currentPeriodEnd: opts.periodEnd ?? null,
        razorpaySubscriptionId: opts.razorpaySubscriptionId ?? null,
        razorpayCustomerId: opts.razorpayCustomerId ?? null,
        updatedAt: new Date(),
      },
    });
}

/** Sets the subscription's lifecycle status (e.g. cancelled / expired). */
export async function setSubscriptionStatus(orgId: string, status: string): Promise<void> {
  await db()
    .update(subscriptions)
    .set({ status, updatedAt: new Date() })
    .where(eq(subscriptions.orgId, orgId));
}

/** Downgrades an org to the free plan (on cancellation/expiry). */
export async function downgradeToFree(orgId: string): Promise<void> {
  await db().update(organizations).set({ plan: "free" }).where(eq(organizations.id, orgId));
}

/** Records a payment lifecycle event idempotently (spec §3.22). */
export async function recordPaymentEvent(entry: {
  orgId: string;
  razorpayEventId: string;
  type: string;
  amountPaise: number;
  status: string;
  reason?: string | null;
}): Promise<void> {
  await db()
    .insert(paymentEvents)
    .values({
      orgId: entry.orgId,
      razorpayEventId: entry.razorpayEventId,
      type: entry.type,
      amount: (entry.amountPaise / 100).toFixed(2),
      status: entry.status,
      reason: entry.reason ?? null,
    })
    .onConflictDoNothing({ target: paymentEvents.razorpayEventId });
}

/** Finds the org that owns a Razorpay subscription id. */
export async function orgIdForSubscription(razorpaySubscriptionId: string): Promise<string | null> {
  const rows = await db()
    .select({ orgId: subscriptions.orgId })
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId))
    .limit(1);
  return rows[0]?.orgId ?? null;
}
