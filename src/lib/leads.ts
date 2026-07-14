import { desc, eq } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";
import { leads, tenders } from "@/db/schema";
import { scoreTender, type CompanyProfileInput } from "@/lib/scoring";
import { matchingTendersEmail, sendEmail, welcomeEmail, type MatchLine } from "@/lib/email";

export interface LeadInput {
  email: string;
  companyName?: string | null;
  capabilities: string;
  tenderText?: string | null;
  matchScore?: number;
  eligibilityScore?: number;
  winProbability?: number;
  verdict?: string;
}

/**
 * Captures a free-check lead and, on first capture, fires the two trigger
 * emails (welcome + matching tenders). Idempotent per email — repeat checks
 * update the row but don't re-send. Email/DB failures are logged, never
 * thrown to the caller (the checker result must not depend on this).
 */
export async function captureLeadAndNotify(input: LeadInput): Promise<void> {
  if (!isDbConfigured()) return;
  const email = input.email.trim().toLowerCase();
  const d = db();

  try {
    const [lead] = await d
      .insert(leads)
      .values({
        email,
        companyName: input.companyName || null,
        capabilities: input.capabilities,
        tenderText: input.tenderText || null,
        matchScore: input.matchScore,
        eligibilityScore: input.eligibilityScore,
        winProbability: input.winProbability,
        verdict: input.verdict,
        source: "free_check",
      })
      .onConflictDoUpdate({
        target: leads.email,
        set: {
          companyName: input.companyName || null,
          capabilities: input.capabilities,
          tenderText: input.tenderText || null,
          matchScore: input.matchScore,
          eligibilityScore: input.eligibilityScore,
          winProbability: input.winProbability,
          verdict: input.verdict,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Only email once per lead (on first capture).
    if (lead.welcomedAt) return;

    const company: CompanyProfileInput = {
      description: input.capabilities,
      annualTurnover: null,
      gstNumber: null,
      msmeNumber: null,
      employeeCount: null,
    };

    const [welcome, matches] = await Promise.all([
      Promise.resolve(welcomeEmail(input.companyName || "")),
      topMatchesForCapabilities(company, 5),
    ]);

    try {
      const res = await sendEmail({ to: email, ...welcome });
      // A skipped send (RESEND_API_KEY unset) must NOT mark the lead as
      // welcomed — otherwise the address is permanently burned and never
      // receives the email once Resend is configured.
      if (!res.sent) return;
      if (matches.length > 0) {
        await sendEmail({ to: email, ...matchingTendersEmail(matches) });
      }
      await d
        .update(leads)
        .set({ welcomedAt: new Date(), matchedEmailAt: new Date() })
        .where(eq(leads.id, lead.id));
    } catch (err) {
      console.error("[leads] email send failed", err);
    }
  } catch (err) {
    console.error("[leads] capture failed", err);
  }
}

/**
 * Scores the ingested tender feed against the lead's capabilities and
 * returns the top matches. Live data only — returns an empty list when the
 * database has no tenders yet (no sample fallback).
 */
async function topMatchesForCapabilities(
  company: CompanyProfileInput,
  limit: number,
): Promise<MatchLine[]> {
  const rows = await db()
    .select({
      title: tenders.title,
      department: tenders.department,
      source: tenders.source,
      submissionDate: tenders.submissionDate,
      estimatedValue: tenders.estimatedValue,
    })
    .from(tenders)
    .where(eq(tenders.status, "open"))
    .orderBy(desc(tenders.createdAt))
    .limit(60);

  // Live tenders only — if the feed is empty, the matching email simply has
  // no rows (no sample fallback).
  return rows
    .map((t) => {
      const r = scoreTender(company, {
        title: t.title,
        department: t.department,
        estimatedValue: t.estimatedValue,
        emd: null,
        requirements: [],
      });
      return {
        title: t.title,
        department: t.department,
        source: t.source,
        submissionDate: t.submissionDate ? new Date(t.submissionDate) : null,
        matchScore: r.matchScore,
        eligibilityScore: r.eligibilityScore,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
