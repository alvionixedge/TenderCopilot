import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, proposalVersions, tenders } from "@/db/schema";
import { ApiError, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { markdownToDocx } from "@/lib/docx";

export const maxDuration = 30;

/**
 * GET /api/v1/proposals/:id/download — renders the current revision as
 * DOCX. Auth re-checked at the data layer (spec 6.3); every download is
 * audit-logged.
 */
export const GET = withErrorHandling(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireSession();
    const { id } = await params;
    const d = db();

    const proposal = await d.query.proposals.findFirst({
      where: and(eq(proposals.id, id), eq(proposals.orgId, ctx.orgId)),
    });
    if (!proposal) throw new ApiError("not_found", 404, "Proposal not found.");
    if (proposal.status !== "ready" && proposal.status !== "submitted") {
      throw new ApiError("not_ready", 409, "Proposal is not ready for download.");
    }

    const version = await d.query.proposalVersions.findFirst({
      where: and(
        eq(proposalVersions.proposalId, proposal.id),
        eq(proposalVersions.version, proposal.currentVersion),
      ),
    });
    if (!version?.contentMd) {
      throw new ApiError("no_content", 409, "No generated content for this revision.");
    }

    const tender = await d.query.tenders.findFirst({
      where: eq(tenders.id, proposal.tenderId),
    });

    const buffer = await markdownToDocx(
      `Proposal — ${tender?.title ?? "Tender"}`,
      version.contentMd,
    );

    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "document.downloaded",
      entityType: "proposals",
      entityId: proposal.id,
      metadata: { version: proposal.currentVersion },
    });

    const filename = `proposal-v${proposal.currentVersion}.docx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
