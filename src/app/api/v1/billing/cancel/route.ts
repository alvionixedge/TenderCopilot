import { NextResponse } from "next/server";
import { ApiError, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { scheduleCancellation } from "@/lib/billing";

/**
 * POST /api/v1/billing/cancel — cancels the org's paid plan at period end
 * (spec §11). No refund; access continues until the paid period ends.
 * Owner/admin only.
 */
export const POST = withErrorHandling(async () => {
  const ctx = await requireSession();
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    throw new ApiError("forbidden", 403, "Only an owner or admin can manage billing.");
  }
  await scheduleCancellation(ctx.orgId);
  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "billing.cancelled",
    entityType: "subscriptions",
    entityId: ctx.orgId,
  });
  return NextResponse.json({ ok: true });
});
