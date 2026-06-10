import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { proposals, proposalVersions } from "@/db/schema";
import { ApiError, requireSession, withErrorHandling } from "@/lib/api";

/**
 * GET /api/v1/proposals/:id — proposal status + download pointer (spec 4.4).
 * The MVP serves the DOCX from /download (rendered on demand); when R2
 * archiving is enabled this returns a pre-signed URL instead.
 */
export const GET = withErrorHandling(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireSession();
    const { id } = await params;

    const proposal = await db().query.proposals.findFirst({
      where: and(eq(proposals.id, id), eq(proposals.orgId, ctx.orgId)),
    });
    if (!proposal) throw new ApiError("not_found", 404, "Proposal not found.");

    const version = await db().query.proposalVersions.findFirst({
      where: and(
        eq(proposalVersions.proposalId, proposal.id),
        eq(proposalVersions.version, proposal.currentVersion),
      ),
    });

    return NextResponse.json({
      id: proposal.id,
      status: proposal.status,
      version: proposal.currentVersion,
      completeness: version?.completeness ?? null,
      downloadUrl:
        proposal.status === "ready" ? `/api/v1/proposals/${proposal.id}/download` : null,
    });
  },
);
