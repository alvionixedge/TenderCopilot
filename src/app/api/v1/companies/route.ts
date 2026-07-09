import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { consumeEntitlement, getEffectivePlan } from "@/lib/entitlements";

const createCompanySchema = z.object({
  companyName: z.string().min(2).max(255),
  gstNumber: z.string().length(15).optional().or(z.literal("")),
  panNumber: z.string().length(10).optional().or(z.literal("")),
  msmeNumber: z.string().max(30).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  description: z.string().min(10).max(8000),
  employeeCount: z.coerce.number().int().positive().optional(),
  annualTurnover: z.coerce.number().nonnegative().optional(),
});

/** POST /api/v1/companies — create a company profile (spec 4.2). */
export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const body = await parseBody(req, createCompanySchema);

  const plan = await getEffectivePlan(ctx.orgId);
  await consumeEntitlement(ctx.orgId, plan, "companies");

  const [company] = await db()
    .insert(companies)
    .values({
      orgId: ctx.orgId,
      companyName: body.companyName,
      gstNumber: body.gstNumber || null,
      panNumber: body.panNumber || null,
      msmeNumber: body.msmeNumber || null,
      website: body.website || null,
      description: body.description,
      employeeCount: body.employeeCount ?? null,
      annualTurnover: body.annualTurnover?.toFixed(2) ?? null,
    })
    .returning({ id: companies.id });

  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "company.created",
    entityType: "companies",
    entityId: company.id,
  });

  // Embedding generation is queued asynchronously in the full pipeline.
  return NextResponse.json({ id: company.id, embeddingStatus: "pending" }, { status: 201 });
});

/** GET /api/v1/companies — list the org's companies. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireSession();
  const rows = await db()
    .select({
      id: companies.id,
      companyName: companies.companyName,
      gstNumber: companies.gstNumber,
      msmeNumber: companies.msmeNumber,
      annualTurnover: companies.annualTurnover,
      createdAt: companies.createdAt,
    })
    .from(companies)
    .where(eq(companies.orgId, ctx.orgId));
  return NextResponse.json({ items: rows });
});
