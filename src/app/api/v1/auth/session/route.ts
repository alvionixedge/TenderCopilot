import { NextResponse } from "next/server";
import { requireSession, withErrorHandling } from "@/lib/api";
import { getActiveCompany } from "@/lib/tenant";

/** POST /api/v1/auth/session — current session + resolved company context (spec 4.1). */
export const POST = withErrorHandling(async () => {
  const ctx = await requireSession();
  const company = await getActiveCompany(ctx.orgId);
  return NextResponse.json({
    userId: ctx.userId,
    activeCompanyId: company?.id ?? null,
    plan: ctx.plan,
  });
});

export const GET = POST;
