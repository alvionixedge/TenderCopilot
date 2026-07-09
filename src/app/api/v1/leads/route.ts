import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiError } from "@/lib/api";
import { enforcePublicRateLimit } from "@/lib/ratelimit";
import { captureLeadAndNotify } from "@/lib/leads";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/v1/leads — public lead capture for the free-check funnel.
 * Called by the browser after the instant result is shown (so the result
 * isn't blocked on email delivery). Stores the lead and fires the welcome +
 * matching-tenders emails on first capture.
 */
const schema = z.object({
  email: z.string().email().max(255),
  companyName: z.string().max(255).optional().or(z.literal("")),
  capabilities: z.string().min(1).max(4000),
  tenderText: z.string().max(6000).optional().or(z.literal("")),
  matchScore: z.number().int().min(0).max(100).optional(),
  eligibilityScore: z.number().int().min(0).max(100).optional(),
  winProbability: z.number().int().min(0).max(100).optional(),
  verdict: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  // Stricter cap than the scorer — this endpoint sends email.
  try {
    await enforcePublicRateLimit(req, "leads", 6);
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
    return apiError("validation_error", parsed.error.errors[0]?.message ?? "Invalid.", 422);
  }
  const b = parsed.data;

  await captureLeadAndNotify({
    email: b.email,
    companyName: b.companyName || null,
    capabilities: b.capabilities,
    tenderText: b.tenderText || null,
    matchScore: b.matchScore,
    eligibilityScore: b.eligibilityScore,
    winProbability: b.winProbability,
    verdict: b.verdict,
  });

  return NextResponse.json({ ok: true });
}
