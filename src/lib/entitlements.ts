import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { planFeatures, usageCounters } from "@/db/schema";
import { ApiError } from "./errors";

/** Default entitlement caps; mirrored in the seeded plan_features rows. */
export const DEFAULT_LIMITS: Record<string, Record<string, number | null>> = {
  free: { proposals_per_month: 3, tenders_per_day: 20, seats: 1, companies: 1 },
  pro: { proposals_per_month: 25, tenders_per_day: 200, seats: 5, companies: 3 },
  business: { proposals_per_month: null, tenders_per_day: null, seats: 25, companies: 25 },
};

export function periodStartFor(period: string, now = new Date()): string {
  if (period === "day") return now.toISOString().slice(0, 10);
  if (period === "month")
    return `${now.toISOString().slice(0, 7)}-01`;
  return "1970-01-01"; // total
}

export async function getLimit(plan: string, featureKey: string): Promise<{ limit: number | null; period: string }> {
  const rows = await db()
    .select()
    .from(planFeatures)
    .where(and(eq(planFeatures.plan, plan), eq(planFeatures.featureKey, featureKey)))
    .limit(1);
  if (rows[0]) return { limit: rows[0].limitValue, period: rows[0].period };
  const fallback = DEFAULT_LIMITS[plan]?.[featureKey];
  return { limit: fallback === undefined ? null : fallback, period: featureKey.endsWith("_per_day") ? "day" : "month" };
}

/**
 * Checks the org's usage counter against the plan cap and increments it
 * atomically (spec 3.18/3.19, 11.2). Throws 402-style error when over cap.
 */
export async function consumeEntitlement(
  orgId: string,
  plan: string,
  featureKey: string,
  amount = 1,
): Promise<void> {
  const { limit, period } = await getLimit(plan, featureKey);
  if (limit === null) return; // unlimited

  const window = periodStartFor(period);
  const d = db();

  const [counter] = await d
    .insert(usageCounters)
    .values({ orgId, featureKey, periodStart: window, used: amount })
    .onConflictDoUpdate({
      target: [usageCounters.orgId, usageCounters.featureKey, usageCounters.periodStart],
      set: {
        used: sql`${usageCounters.used} + ${amount}`,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (counter.used > limit) {
    // Roll back the increment so retries after upgrade succeed.
    await d
      .update(usageCounters)
      .set({ used: sql`${usageCounters.used} - ${amount}` })
      .where(
        and(
          eq(usageCounters.orgId, orgId),
          eq(usageCounters.featureKey, featureKey),
          eq(usageCounters.periodStart, window),
        ),
      );
    throw new ApiError(
      "plan_limit_reached",
      402,
      `Your ${plan} plan allows ${limit} ${featureKey.replace(/_/g, " ")}. Upgrade to continue.`,
    );
  }
}
