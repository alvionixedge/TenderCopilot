import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { checkDeletionEligibility, deleteAccount } from "@/lib/account";

/** GET /api/v1/account — deletion eligibility for the current user. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireSession();
  const eligibility = await checkDeletionEligibility(ctx.userId);
  return NextResponse.json(eligibility);
});

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

/**
 * DELETE /api/v1/account — permanent account + organization data deletion
 * (RTBF). Requires an explicit confirmation token to avoid accidental loss.
 */
export const DELETE = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const body = await parseBody(req, deleteSchema).catch(() => null);
  if (!body) {
    throw new ApiError("confirmation_required", 400, "Type DELETE to confirm account deletion.");
  }
  await deleteAccount(ctx.userId);
  return NextResponse.json({ ok: true });
});
