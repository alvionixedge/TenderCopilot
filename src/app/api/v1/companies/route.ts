import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { consumeEntitlement, getEffectivePlan } from "@/lib/entitlements";

// GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum char.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

const createCompanySchema = z.object({
  // Required to unlock the tender feed (see lib/company-profile).
  companyName: z.string().min(2).max(255),
  gstNumber: z.string().regex(GSTIN_RE, "Enter a valid 15-character GSTIN."),
  annualTurnover: z.coerce.number().positive("Enter your annual turnover in INR."),
  description: z.string().min(10).max(8000),
  // Optional.
  panNumber: z.string().length(10).optional().or(z.literal("")),
  msmeNumber: z.string().max(30).optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  employeeCount: z.coerce.number().int().positive().optional(),
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
      annualTurnover: body.annualTurnover.toFixed(2),
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

/** PATCH /api/v1/companies — update the org's active company profile. */
export const PATCH = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const body = await parseBody(req, createCompanySchema);

  const [existing] = await db()
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.orgId, ctx.orgId))
    .orderBy(companies.createdAt)
    .limit(1);
  if (!existing) {
    return NextResponse.json(
      { error: { code: "not_found", message: "No company profile to update." } },
      { status: 404 },
    );
  }

  await db()
    .update(companies)
    .set({
      companyName: body.companyName,
      gstNumber: body.gstNumber,
      panNumber: body.panNumber || null,
      msmeNumber: body.msmeNumber || null,
      website: body.website || null,
      description: body.description,
      employeeCount: body.employeeCount ?? null,
      annualTurnover: body.annualTurnover.toFixed(2),
    })
    .where(eq(companies.id, existing.id));

  await recordAudit({
    orgId: ctx.orgId,
    actorUserId: ctx.userId,
    action: "company.updated",
    entityType: "companies",
    entityId: existing.id,
  });

  return NextResponse.json({ id: existing.id, updated: true });
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
