import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  jobs,
  proposals,
  proposalVersions,
  tenderRequirements,
  tenders,
} from "@/db/schema";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { consumeEntitlement, getEffectivePlan } from "@/lib/entitlements";
import { generateProposal } from "@/lib/proposal";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { getActiveCompany } from "@/lib/tenant";

export const maxDuration = 60;

const createSchema = z.object({
  tenderId: z.string().uuid(),
  format: z.enum(["docx", "pdf"]).default("docx"),
});

/**
 * POST /api/v1/proposals — proposal generation (spec 4.4). Idempotent per
 * (tender, company): a retry creates a new revision, never a duplicate.
 *
 * MVP note: generation runs within the request (maxDuration 60s) and the
 * jobs row records the lifecycle; the QStash worker path is the production
 * scale-out (spec 6.2, 9.2).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const body = await parseBody(req, createSchema);

  const company = await getActiveCompany(ctx.orgId);
  if (!company) {
    throw new ApiError("no_company", 409, "Create your company profile before generating proposals.");
  }

  await enforceAiRateLimit(ctx.userId, ctx.orgId);
  const plan = await getEffectivePlan(ctx.orgId);
  await consumeEntitlement(ctx.orgId, plan, "proposals_per_month");

  const d = db();
  const tender = await d.query.tenders.findFirst({ where: eq(tenders.id, body.tenderId) });
  if (!tender) throw new ApiError("not_found", 404, "Tender not found.");

  // Idempotency: reuse the proposal shell per (org, company, tender).
  let proposal = await d.query.proposals.findFirst({
    where: and(
      eq(proposals.orgId, ctx.orgId),
      eq(proposals.companyId, company.id),
      eq(proposals.tenderId, body.tenderId),
    ),
  });
  let nextVersion = 1;
  if (proposal) {
    nextVersion = proposal.currentVersion + 1;
    await d
      .update(proposals)
      .set({ status: "generating", currentVersion: nextVersion })
      .where(eq(proposals.id, proposal.id));
  } else {
    const [created] = await d
      .insert(proposals)
      .values({
        orgId: ctx.orgId,
        companyId: company.id,
        tenderId: body.tenderId,
        status: "generating",
        currentVersion: 1,
      })
      .returning();
    proposal = created;
  }

  const [job] = await d
    .insert(jobs)
    .values({
      orgId: ctx.orgId,
      type: "generate_proposal",
      status: "running",
      payload: { proposalId: proposal.id, tenderId: body.tenderId, version: nextVersion },
    })
    .returning({ id: jobs.id });

  try {
    const requirements = await d
      .select()
      .from(tenderRequirements)
      .where(
        and(
          eq(tenderRequirements.tenderId, tender.id),
          eq(tenderRequirements.tenderVersion, tender.currentVersion),
        ),
      );

    const generated = await generateProposal({
      orgId: ctx.orgId,
      company: {
        companyName: company.companyName,
        description: company.description,
        gstNumber: company.gstNumber,
        panNumber: company.panNumber,
        msmeNumber: company.msmeNumber,
        annualTurnover: company.annualTurnover,
        employeeCount: company.employeeCount,
        website: company.website,
      },
      tender: {
        title: tender.title,
        department: tender.department,
        source: tender.source,
        estimatedValue: tender.estimatedValue,
        emd: tender.emd,
        submissionDate: tender.submissionDate,
      },
      requirements: requirements.map((r) => ({
        requirement: r.requirement,
        mandatory: r.mandatory,
        category: r.category,
      })),
    });

    await d.insert(proposalVersions).values({
      proposalId: proposal.id,
      version: nextVersion,
      label: "draft",
      contentMd: generated.contentMd,
      completeness: generated.completeness,
      aiTraceId: generated.traceId,
      createdBy: ctx.userId,
      generatedAt: new Date(),
    });

    await d.update(proposals).set({ status: "ready" }).where(eq(proposals.id, proposal.id));
    await d
      .update(jobs)
      .set({ status: "succeeded", updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "proposal.generated",
      entityType: "proposals",
      entityId: proposal.id,
      metadata: { version: nextVersion, completeness: generated.completeness },
    });
  } catch (err) {
    // Persist failed state — never a silent stuck 'generating' (spec 6.2).
    await d.update(proposals).set({ status: "failed" }).where(eq(proposals.id, proposal.id));
    await d
      .update(jobs)
      .set({ status: "failed", lastError: String(err), updatedAt: new Date() })
      .where(eq(jobs.id, job.id));
    throw new ApiError("generation_failed", 502, "Proposal generation failed. Please retry.");
  }

  return NextResponse.json(
    { proposalId: proposal.id, status: "ready" },
    { status: 202 },
  );
});

/** GET /api/v1/proposals — list the org's proposals. */
export const GET = withErrorHandling(async () => {
  const ctx = await requireSession();
  const rows = await db()
    .select({
      id: proposals.id,
      status: proposals.status,
      currentVersion: proposals.currentVersion,
      createdAt: proposals.createdAt,
      tenderTitle: tenders.title,
    })
    .from(proposals)
    .innerJoin(tenders, eq(proposals.tenderId, tenders.id))
    .where(eq(proposals.orgId, ctx.orgId))
    .orderBy(desc(proposals.createdAt));
  return NextResponse.json({ items: rows });
});
