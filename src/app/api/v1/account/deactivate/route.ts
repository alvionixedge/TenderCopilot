import { NextResponse } from "next/server";
import { requireSession, withErrorHandling } from "@/lib/api";
import { deactivateAccount } from "@/lib/account";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/v1/account/deactivate — reversible self-deactivation. Signs the
 * user out; the account reactivates automatically on next login.
 */
export const POST = withErrorHandling(async () => {
  const ctx = await requireSession();
  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "account.deactivated",
    entityType: "users",
    entityId: ctx.userId,
  });
  await deactivateAccount(ctx.userId);
  return NextResponse.json({ ok: true });
});
