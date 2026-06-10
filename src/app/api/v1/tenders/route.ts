import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenderMatches, tenders } from "@/db/schema";
import { requireSession, withErrorHandling } from "@/lib/api";
import { getActiveCompany } from "@/lib/tenant";

/**
 * GET /api/v1/tenders?match=true&limit=20 — ranked tender feed for the
 * active company, sorted by match score (spec 4.3).
 */
export const GET = withErrorHandling(async (req: Request) => {
  const ctx = await requireSession();
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 50);
  const matchOnly = url.searchParams.get("match") === "true";

  const company = await getActiveCompany(ctx.orgId);
  const d = db();

  if (matchOnly && company) {
    const rows = await d
      .select({
        tenderId: tenders.id,
        title: tenders.title,
        source: tenders.source,
        department: tenders.department,
        estimatedValue: tenders.estimatedValue,
        submissionDate: tenders.submissionDate,
        status: tenders.status,
        matchScore: tenderMatches.matchScore,
        eligibilityScore: tenderMatches.eligibilityScore,
        winProbability: tenderMatches.winProbability,
      })
      .from(tenderMatches)
      .innerJoin(tenders, eq(tenderMatches.tenderId, tenders.id))
      .where(
        and(eq(tenderMatches.orgId, ctx.orgId), eq(tenderMatches.companyId, company.id)),
      )
      .orderBy(desc(tenderMatches.matchScore))
      .limit(limit);
    return NextResponse.json({ items: rows, nextCursor: null });
  }

  const rows = await d
    .select({
      tenderId: tenders.id,
      title: tenders.title,
      source: tenders.source,
      department: tenders.department,
      estimatedValue: tenders.estimatedValue,
      submissionDate: tenders.submissionDate,
      status: tenders.status,
    })
    .from(tenders)
    .where(eq(tenders.status, "open"))
    .orderBy(desc(tenders.createdAt))
    .limit(limit);

  return NextResponse.json({ items: rows, nextCursor: null });
});
