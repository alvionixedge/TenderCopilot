import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { PLANS, razorpayPlanIdFor } from "@/lib/plans";
import {
  createOrder,
  createSubscription,
  isRazorpayConfigured,
  publicKeyId,
} from "@/lib/razorpay";

const schema = z.object({
  plan: z.enum(["pro", "business"]),
  mode: z.enum(["once", "recurring"]),
});

/**
 * POST /api/v1/billing/checkout — starts a payment (spec §11).
 * `mode: "once"`      → a one-time Razorpay Order for one month.
 * `mode: "recurring"` → a Razorpay Subscription (auto-billing) using the
 *                        pre-created Plan ID for the tier.
 * Returns the handles the client needs to open Razorpay Checkout. Only
 * owners/admins may initiate billing.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new ApiError("forbidden", 403, "Only an owner or admin can manage billing.");
  }
  if (!isRazorpayConfigured()) {
    throw new ApiError(
      "billing_unconfigured",
      503,
      "Payments are not configured for this environment (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).",
    );
  }

  const { plan, mode } = await parseBody(req, schema);
  const def = PLANS[plan];

  if (mode === "once") {
    const order = await createOrder({
      amountPaise: def.amountPaise,
      receipt: `org_${ctx.orgId}_${Date.now()}`.slice(0, 40),
      notes: { orgId: ctx.orgId, plan, mode },
    });
    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "billing.order_created",
      entityType: "subscriptions",
      entityId: ctx.orgId,
      metadata: { plan, mode, orderId: order.id },
    });
    return NextResponse.json({
      mode,
      keyId: publicKeyId(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      planName: def.name,
    });
  }

  // recurring
  const planId = razorpayPlanIdFor(plan);
  if (!planId) {
    throw new ApiError(
      "recurring_unconfigured",
      503,
      `Recurring billing for the ${plan} plan is not configured (set RAZORPAY_PLAN_${plan.toUpperCase()}). You can still pay monthly.`,
    );
  }
  const sub = await createSubscription({
    planId,
    notes: { orgId: ctx.orgId, plan, mode },
  });
  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "billing.subscription_created",
    entityType: "subscriptions",
    entityId: ctx.orgId,
    metadata: { plan, mode, subscriptionId: sub.id },
  });
  return NextResponse.json({
    mode,
    keyId: publicKeyId(),
    subscriptionId: sub.id,
    plan,
    planName: def.name,
  });
});
