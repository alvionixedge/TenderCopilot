import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay integration (spec §2.2, §11, §8.5 webhook security).
 * Implemented over the REST API with Basic auth + HMAC signatures, so no
 * extra SDK dependency. Keys are server-only and never shipped to the
 * browser; the public key id is returned per-checkout instead.
 */

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function publicKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

function authHeader(): string {
  const token = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");
  return `Basic ${token}`;
}

async function rzpPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      (json as { error?: { description?: string } })?.error?.description ||
      `Razorpay ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export async function createOrder(opts: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return rzpPost<RazorpayOrder>("/orders", {
    amount: opts.amountPaise,
    currency: "INR",
    receipt: opts.receipt,
    notes: opts.notes,
  });
}

export interface RazorpaySubscription {
  id: string;
  status: string;
}

export async function createSubscription(opts: {
  planId: string;
  totalCount?: number;
  notes: Record<string, string>;
}): Promise<RazorpaySubscription> {
  return rzpPost<RazorpaySubscription>("/subscriptions", {
    plan_id: opts.planId,
    total_count: opts.totalCount ?? 12, // 12 billing cycles, then renew
    customer_notify: 1,
    notes: opts.notes,
  });
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Order payment signature: HMAC(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, opts.signature);
}

/** Subscription payment signature: HMAC(payment_id|subscription_id, key_secret). */
export function verifySubscriptionSignature(opts: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${opts.paymentId}|${opts.subscriptionId}`)
    .digest("hex");
  return safeEqualHex(expected, opts.signature);
}

/** Webhook signature: HMAC(raw_body, webhook_secret) (spec §8.5). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
