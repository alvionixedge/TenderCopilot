import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenderMatches, tenderRequirements, tenders } from "@/db/schema";
import { aiScoreTender } from "@/lib/ai-scoring";
import { ApiError, requireSession, withErrorHandling } from "@/lib/api";
import { isAiConfigured } from "@/lib/ai";
import { recordAudit } from "@/lib/audit";
import { enforceAiRateLimit } from "@/lib/ratelimit";
import { scoreTender } from "@/lib/scoring";
import { getActiveCompany } from "@/lib/tenant";

export const maxDuration = 60;

/**
 * POST /api/v1/tenders/:id/analyze — requirement extraction + scoring for
 * a tender against the active company (spec 4.3). Idempotent per
 * (tender, version, company): re-running overwrites the match.
 */
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireSession();
    const { id: tenderId } = await params;

    const company = await getActiveCompany(ctx.orgId);
    if (!company) {
      throw new ApiError("no_company", 409, "Create your company profile before analyzing tenders.");
    }

    await enforceAiRateLimit(ctx.userId, ctx.orgId);

    const d = db();
    const tender = await d.query.tenders.findFirst({ where: eq(tenders.id, tenderId) });
    if (!tender) throw new ApiError("not_found", 404, "Tender not found.");

    const requirements = await d
      .select()
      .from(tenderRequirements)
      .where(
        and(
          eq(tenderRequirements.tenderId, tenderId),
          eq(tenderRequirements.tenderVersion, tender.currentVersion),
        ),
      );

    const companyInput = {
      description: company.description,
      annualTurnover: company.annualTurnover,
      gstNumber: company.gstNumber,
      msmeNumber: company.msmeNumber,
      employeeCount: company.employeeCount,
    };
    const tenderInput = {
      title: tender.title,
      department: tender.department,
      estimatedValue: tender.estimatedValue,
      emd: tender.emd,
      requirements: requirements.map((r) => ({
        requirement: r.requirement,
        mandatory: r.mandatory,
      })),
    };

    // Deterministic heuristic is always computed — it is the fallback when AI
    // is unconfigured or errors, so the feature never hard-fails.
    let result = scoreTender(companyInput, tenderInput);
    let reasoning = result.reasons.map((r) => `• ${r}`).join("\n");
    let aiTraceId: string | null = null;

    if (isAiConfigured()) {
      try {
        // AI reads the capability statement against the requirements and sets
        // the actual scores (capability-aware), not just the prose.
        const ai = await aiScoreTender(ctx.orgId, companyInput, tenderInput);
        result = {
          matchScore: ai.matchScore,
          eligibilityScore: ai.eligibilityScore,
          winProbability: ai.winProbability,
          reasons: ai.reasons,
        };
        reasoning = ai.reasoning;
        aiTraceId = ai.aiTraceId;
      } catch (err) {
        console.error("[analyze] AI scoring failed, using heuristic scores", err);
      }
    }

    const [match] = await d
      .insert(tenderMatches)
      .values({
        orgId: ctx.orgId,
        tenderId,
        tenderVersion: tender.currentVersion,
        companyId: company.id,
        matchScore: result.matchScore,
        eligibilityScore: result.eligibilityScore,
        winProbability: result.winProbability,
        reasoning,
        aiTraceId,
        isStale: false,
      })
      .onConflictDoUpdate({
        target: [tenderMatches.tenderId, tenderMatches.tenderVersion, tenderMatches.companyId],
        set: {
          matchScore: result.matchScore,
          eligibilityScore: result.eligibilityScore,
          winProbability: result.winProbability,
          reasoning,
          aiTraceId,
          isStale: false,
        },
      })
      .returning({ id: tenderMatches.id });

    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "tender.analyzed",
      entityType: "tender_matches",
      entityId: match.id,
      metadata: { tenderId, matchScore: result.matchScore },
    });

    return NextResponse.json({ matchId: match.id, status: "completed" }, { status: 202 });
  },
);
