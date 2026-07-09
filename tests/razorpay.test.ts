import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
} from "@/lib/razorpay";

const KEY_SECRET = "test_key_secret_123";
const WEBHOOK_SECRET = "test_webhook_secret_456";

beforeAll(() => {
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(() => {
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyPaymentSignature (Orders API)", () => {
  it("accepts a correct order|payment signature", () => {
    const orderId = "order_ABC";
    const paymentId = "pay_XYZ";
    const signature = sign(KEY_SECRET, `${orderId}|${paymentId}`);
    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(
      verifyPaymentSignature({
        orderId: "order_ABC",
        paymentId: "pay_XYZ",
        signature: "deadbeef",
      }),
    ).toBe(false);
  });

  it("rejects when the payment id is swapped", () => {
    const signature = sign(KEY_SECRET, `order_ABC|pay_XYZ`);
    expect(
      verifyPaymentSignature({ orderId: "order_ABC", paymentId: "pay_OTHER", signature }),
    ).toBe(false);
  });
});

describe("verifySubscriptionSignature (Subscriptions API)", () => {
  it("accepts a correct payment|subscription signature", () => {
    const paymentId = "pay_XYZ";
    const subscriptionId = "sub_123";
    const signature = sign(KEY_SECRET, `${paymentId}|${subscriptionId}`);
    expect(verifySubscriptionSignature({ paymentId, subscriptionId, signature })).toBe(true);
  });

  it("rejects a forged signature", () => {
    expect(
      verifySubscriptionSignature({
        paymentId: "pay_XYZ",
        subscriptionId: "sub_123",
        signature: "00",
      }),
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a body signed with the webhook secret", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = sign(WEBHOOK_SECRET, body);
    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const signature = sign("wrong_secret", body);
    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });

  it("rejects a null signature header", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects when the body is altered after signing", () => {
    const signature = sign(WEBHOOK_SECRET, JSON.stringify({ amount: 100 }));
    expect(verifyWebhookSignature(JSON.stringify({ amount: 999999 }), signature)).toBe(false);
  });
});
