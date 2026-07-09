import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { activatePlan, addMonths, recordPaymentEvent } from "@/lib/billing";
import { PLANS } from "@/lib/plans";
import { verifyPaymentSignature, verifySubscriptionSignature } from "@/lib/razorpay";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("once"),
    plan: z.enum(["pro", "business"]),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
  z.object({
    mode: z.literal("recurring"),
    plan: z.enum(["pro", "business"]),
    razorpay_payment_id: z.string().min(1),
    razorpay_subscription_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),
]);

/**
 * POST /api/v1/billing/verify — confirms a successful Razorpay Checkout
 * by verifying the returned signature, then activates the plan for
 * immediate UX (spec §11). The webhook remains the source of truth for
 * renewals and disputes (spec §8.5).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new ApiError("forbidden", 403, "Only an owner or admin can manage billing.");
  }

  const body = await parseBody(req, schema);
  const def = PLANS[body.plan];

  if (body.mode === "once") {
    const ok = verifyPaymentSignature({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    if (!ok) throw new ApiError("signature_invalid", 400, "Payment verification failed.");

    const start = new Date();
    await activatePlan(ctx.orgId, body.plan, {
      status: "active",
      periodStart: start,
      periodEnd: addMonths(start, 1),
    });
    await recordPaymentEvent({
      orgId: ctx.orgId,
      razorpayEventId: body.razorpay_payment_id, // de-dupes against the webhook
      type: "payment",
      amountPaise: def.amountPaise,
      status: "captured",
    });
  } else {
    const ok = verifySubscriptionSignature({
      paymentId: body.razorpay_payment_id,
      subscriptionId: body.razorpay_subscription_id,
      signature: body.razorpay_signature,
    });
    if (!ok) throw new ApiError("signature_invalid", 400, "Subscription verification failed.");

    const start = new Date();
    await activatePlan(ctx.orgId, body.plan, {
      status: "active",
      periodStart: start,
      periodEnd: addMonths(start, 1),
      razorpaySubscriptionId: body.razorpay_subscription_id,
    });
  }

  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "billing.activated",
    entityType: "subscriptions",
    entityId: ctx.orgId,
    metadata: { plan: body.plan, mode: body.mode },
  });

  return NextResponse.json({ ok: true, plan: body.plan });
});
