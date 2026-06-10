import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bidOutcomes, opportunities } from "@/db/schema";
import { ApiError, parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";

const STAGES = [
  "DISCOVERED",
  "QUALIFIED",
  "PROPOSAL",
  "REVIEW",
  "SUBMITTED",
  "WON",
  "LOST",
] as const;

const patchSchema = z.object({
  stage: z.enum(STAGES),
  expectedVersion: z.number().int().positive(),
  outcomeValue: z.coerce.number().nonnegative().optional(),
  lossReason: z
    .enum(["price", "eligibility", "technical", "documentation", "late", "other"])
    .optional(),
});

/**
 * PATCH /api/v1/opportunities/:id — Kanban stage transition (spec 4.5).
 * Optimistic concurrency via the version token: a stale write gets 409
 * (spec 6.4). WON/LOST records the bid outcome atomically.
 */
export const PATCH = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireSession();
    const { id } = await params;
    const body = await parseBody(req, patchSchema);
    const d = db();

    const opp = await d.query.opportunities.findFirst({
      where: and(eq(opportunities.id, id), eq(opportunities.orgId, ctx.orgId)),
    });
    if (!opp) throw new ApiError("not_found", 404, "Opportunity not found.");

    const [updated] = await d
      .update(opportunities)
      .set({ stage: body.stage, version: opp.version + 1 })
      .where(
        and(
          eq(opportunities.id, id),
          eq(opportunities.orgId, ctx.orgId),
          eq(opportunities.version, body.expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      throw new ApiError(
        "version_conflict",
        409,
        "This opportunity was updated by someone else. Refresh and retry.",
      );
    }

    if (body.stage === "WON" || body.stage === "LOST") {
      await d
        .insert(bidOutcomes)
        .values({
          orgId: ctx.orgId,
          opportunityId: updated.id,
          result: body.stage,
          contractValue:
            body.stage === "WON" && body.outcomeValue != null
              ? body.outcomeValue.toFixed(2)
              : null,
          ourBidAmount: body.outcomeValue != null ? body.outcomeValue.toFixed(2) : null,
          lossReason: body.stage === "LOST" ? (body.lossReason ?? "other") : null,
          recordedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [bidOutcomes.opportunityId],
          set: {
            result: body.stage,
            lossReason: body.stage === "LOST" ? (body.lossReason ?? "other") : null,
          },
        });
    }

    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: body.stage === "WON" ? "opportunity.won" : `opportunity.stage_changed`,
      entityType: "opportunities",
      entityId: updated.id,
      metadata: { from: opp.stage, to: body.stage },
    });

    return NextResponse.json({
      id: updated.id,
      stage: updated.stage,
      version: updated.version,
      updatedAt: new Date().toISOString(),
    });
  },
);
