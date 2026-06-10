import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { opportunities, tenders } from "@/db/schema";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { getActiveCompany } from "@/lib/tenant";

const createSchema = z.object({
  tenderId: z.string().uuid(),
});

/** POST /api/v1/opportunities — add a tender to the CRM pipeline. */
export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const body = await parseBody(req, createSchema);

  const company = await getActiveCompany(ctx.orgId);
  if (!company) {
    throw new ApiError("no_company", 409, "Create your company profile first.");
  }

  const d = db();
  const tender = await d.query.tenders.findFirst({ where: eq(tenders.id, body.tenderId) });
  if (!tender) throw new ApiError("not_found", 404, "Tender not found.");

  const existing = await d.query.opportunities.findFirst({
    where: and(
      eq(opportunities.orgId, ctx.orgId),
      eq(opportunities.companyId, company.id),
      eq(opportunities.tenderId, body.tenderId),
    ),
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, stage: existing.stage });
  }

  const [opp] = await d
    .insert(opportunities)
    .values({
      orgId: ctx.orgId,
      companyId: company.id,
      tenderId: body.tenderId,
      stage: "DISCOVERED",
      assignedTo: ctx.userId,
      dueDate: tender.submissionDate,
    })
    .returning();

  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "opportunity.created",
    entityType: "opportunities",
    entityId: opp.id,
    metadata: { tenderId: body.tenderId },
  });

  return NextResponse.json({ id: opp.id, stage: opp.stage }, { status: 201 });
});
