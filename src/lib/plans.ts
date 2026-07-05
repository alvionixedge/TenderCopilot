/**
 * Plan catalogue (spec §11). Prices are INR; Razorpay works in paise.
 * Recurring subscriptions need a pre-created Razorpay Plan ID per tier,
 * supplied via env (RAZORPAY_PLAN_PRO / RAZORPAY_PLAN_BUSINESS).
 */
export type PlanId = "free" | "pro" | "business";

export interface PlanDef {
  id: PlanId;
  name: string;
  amountInr: number; // monthly price, INR
  amountPaise: number; // monthly price, paise (Razorpay unit)
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    amountInr: 0,
    amountPaise: 0,
    blurb: "Evaluate the full workflow",
    features: ["1 company profile", "20 tenders/day", "3 proposals/month", "Single seat"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    amountInr: 4999,
    amountPaise: 499900,
    blurb: "For active bidding teams",
    features: ["3 company profiles", "Full tender feed", "25 proposals/month", "5 seats"],
  },
  business: {
    id: "business",
    name: "Business",
    amountInr: 14999,
    amountPaise: 1499900,
    blurb: "Consultancies & enterprises",
    features: ["25 client companies", "Unlimited proposals", "25 seats", "Win/loss analytics"],
  },
};

export const PAID_PLANS: ("pro" | "business")[] = ["pro", "business"];

export function isPaidPlan(plan: string): plan is "pro" | "business" {
  return plan === "pro" || plan === "business";
}

/** Razorpay Plan ID for recurring billing of a tier (env-supplied). */
export function razorpayPlanIdFor(plan: PlanId): string | undefined {
  if (plan === "pro") return process.env.RAZORPAY_PLAN_PRO || undefined;
  if (plan === "business") return process.env.RAZORPAY_PLAN_BUSINESS || undefined;
  return undefined;
}
