import { NextResponse } from "next/server";
import {
  activatePlan,
  addMonths,
  downgradeToFree,
  orgIdForSubscription,
  recordPaymentEvent,
  setSubscriptionStatus,
} from "@/lib/billing";
import type { PlanId } from "@/lib/plans";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const maxDuration = 30;

/**
 * POST /api/webhooks/razorpay — verified Razorpay webhook (spec §8.5).
 * The authoritative source for renewals, cancellations and refunds.
 * Idempotent: the delivery's x-razorpay-event-id de-dupes replays via the
 * payment_events unique key. Always returns 200 on a known/duplicate
 * event so Razorpay stops retrying.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json(
      { error: { code: "signature_invalid", message: "Invalid webhook signature." } },
      { status: 400 },
    );
  }

  const eventId = req.headers.get("x-razorpay-event-id") ?? `unknown_${Date.now()}`;

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    switch (event.event) {
      case "payment.captured": {
        const p = event.payload?.payment?.entity;
        const orgId = p?.notes?.orgId;
        if (orgId && p) {
          await recordPaymentEvent({
            orgId,
            razorpayEventId: eventId,
            type: "payment",
            amountPaise: p.amount ?? 0,
            status: "captured",
          });
        }
        break;
      }

      case "subscription.activated":
      case "subscription.charged": {
        const s = event.payload?.subscription?.entity;
        if (s) {
          const orgId = s.notes?.orgId ?? (await orgIdForSubscription(s.id));
          const plan = (s.notes?.plan as PlanId) ?? undefined;
          if (orgId) {
            await activatePlan(orgId, plan ?? "pro", {
              status: "active",
              periodEnd: addMonths(new Date(), 1),
              razorpaySubscriptionId: s.id,
            });
          }
          const pay = event.payload?.payment?.entity;
          if (orgId && pay) {
            await recordPaymentEvent({
              orgId,
              razorpayEventId: eventId,
              type: "payment",
              amountPaise: pay.amount ?? 0,
              status: "captured",
            });
          }
        }
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.halted": {
        const s = event.payload?.subscription?.entity;
        if (s) {
          const orgId = s.notes?.orgId ?? (await orgIdForSubscription(s.id));
          if (orgId) {
            await setSubscriptionStatus(
              orgId,
              event.event === "subscription.halted" ? "past_due" : "cancelled",
            );
            if (event.event !== "subscription.halted") await downgradeToFree(orgId);
          }
        }
        break;
      }

      case "refund.created":
      case "refund.processed": {
        const r = event.payload?.refund?.entity;
        const orgId = r?.notes?.orgId;
        if (orgId && r) {
          await recordPaymentEvent({
            orgId,
            razorpayEventId: eventId,
            type: "refund",
            amountPaise: r.amount ?? 0,
            status: "refunded",
          });
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged so Razorpay stops retrying.
        break;
    }
  } catch (err) {
    console.error("[razorpay webhook] handler error", event.event, err);
    // 500 lets Razorpay retry transient failures.
    return NextResponse.json(
      { error: { code: "handler_error", message: "Webhook handling failed." } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

interface RazorpayEntity {
  id: string;
  amount?: number;
  notes?: Record<string, string>;
}

interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    subscription?: { entity?: RazorpayEntity };
    refund?: { entity?: RazorpayEntity };
  };
}
