import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiError } from "@/lib/api";
import { enforcePublicRateLimit } from "@/lib/ratelimit";
import { scoreTender } from "@/lib/scoring";

export const runtime = "nodejs";

/**
 * POST /api/v1/free-check — public, unauthenticated tender-eligibility
 * checker that powers the /free-check ad landing page. Uses the same
 * deterministic heuristic scorer as the authenticated flow (no AI spend,
 * no database writes, no login). Inputs are length-capped; nothing is
 * persisted.
 */
const schema = z.object({
  companyName: z.string().min(1).max(255).optional().or(z.literal("")),
  capabilities: z.string().min(10).max(4000),
  annualTurnover: z.coerce.number().nonnegative().max(1e13).optional(),
  hasGst: z.boolean().default(false),
  hasMsme: z.boolean().default(false),
  tenderText: z.string().min(5).max(6000),
  estimatedValue: z.coerce.number().nonnegative().max(1e13).optional(),
});

export async function POST(req: Request) {
  try {
    await enforcePublicRateLimit(req, "free-check", 30);
  } catch (e) {
    if (e instanceof ApiError) return apiError(e.code, e.message, e.status);
    throw e;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_json", "Request body must be valid JSON.", 400);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return apiError("validation_error", `${first?.path.join(".") || "body"}: ${first?.message}`, 422);
  }
  const b = parsed.data;

  // Split the pasted tender text into a title + requirement lines.
  const lines = b.tenderText
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 0);
  const title = lines[0] ?? b.tenderText.slice(0, 200);
  const requirements = (lines.length > 1 ? lines.slice(1) : lines).map((l) => ({
    requirement: l,
    mandatory: true,
  }));

  const result = scoreTender(
    {
      description: b.capabilities,
      annualTurnover: b.annualTurnover != null ? String(b.annualTurnover) : null,
      gstNumber: b.hasGst ? "PROVIDED" : null,
      msmeNumber: b.hasMsme ? "PROVIDED" : null,
      employeeCount: null,
    },
    {
      title,
      department: null,
      estimatedValue: b.estimatedValue != null ? String(b.estimatedValue) : null,
      emd: null,
      requirements,
    },
  );

  return NextResponse.json({
    matchScore: result.matchScore,
    eligibilityScore: result.eligibilityScore,
    winProbability: result.winProbability,
    reasons: result.reasons,
    verdict:
      result.eligibilityScore >= 70 && result.matchScore >= 55
        ? "strong"
        : result.eligibilityScore >= 45
          ? "possible"
          : "weak",
  });
}
