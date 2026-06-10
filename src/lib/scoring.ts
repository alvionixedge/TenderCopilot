/**
 * Tender <-> company scoring (spec 3.9, 4.3).
 *
 * The MVP scorer is deterministic and heuristic so it works with zero AI
 * spend; when ANTHROPIC_API_KEY is configured the analyze route augments
 * the result with model-generated reasoning, recorded in ai_generations.
 */

export interface CompanyProfileInput {
  description: string | null;
  annualTurnover: string | null; // numeric comes back as string from pg
  gstNumber: string | null;
  msmeNumber: string | null;
  employeeCount: number | null;
}

export interface TenderInput {
  title: string;
  department: string | null;
  estimatedValue: string | null;
  emd: string | null;
  requirements: { requirement: string; mandatory: boolean }[];
}

export interface ScoreResult {
  matchScore: number; // semantic/keyword fit 0-100
  eligibilityScore: number; // hard criteria 0-100
  winProbability: number; // blended estimate 0-100
  reasons: string[];
}

const STOPWORDS = new Set([
  "the", "of", "for", "and", "a", "an", "to", "in", "on", "at", "by",
  "with", "or", "is", "are", "be", "as", "from", "its", "their", "this",
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function keywordOverlapScore(companyText: string, tenderText: string): number {
  const companyTokens = tokenize(companyText);
  const tenderTokens = tokenize(tenderText);
  if (tenderTokens.size === 0 || companyTokens.size === 0) return 30; // neutral floor
  let hits = 0;
  for (const t of tenderTokens) if (companyTokens.has(t)) hits++;
  const ratio = hits / Math.min(tenderTokens.size, 25);
  return Math.max(15, Math.min(95, Math.round(20 + ratio * 110)));
}

export function scoreTender(company: CompanyProfileInput, tender: TenderInput): ScoreResult {
  const reasons: string[] = [];

  // --- Semantic fit (keyword heuristic at MVP) ---
  const tenderText = [
    tender.title,
    tender.department ?? "",
    ...tender.requirements.map((r) => r.requirement),
  ].join(" ");
  const matchScore = keywordOverlapScore(company.description ?? "", tenderText);
  if (matchScore >= 60) reasons.push("Strong overlap between your capability profile and the tender scope.");
  else if (matchScore >= 40) reasons.push("Partial overlap with the tender scope; review the technical requirements.");
  else reasons.push("Limited keyword overlap with the tender scope.");

  // --- Eligibility (hard criteria) ---
  let eligibility = 100;
  const turnover = company.annualTurnover ? Number(company.annualTurnover) : null;
  const value = tender.estimatedValue ? Number(tender.estimatedValue) : null;

  if (value !== null && turnover !== null) {
    // Common Indian-procurement convention: bidder turnover >= ~30% of value.
    const required = value * 0.3;
    if (turnover < required) {
      eligibility -= 40;
      reasons.push(
        `Annual turnover may fall short of the typical 30% threshold (₹${Math.round(required).toLocaleString("en-IN")} expected).`,
      );
    } else {
      reasons.push("Turnover comfortably exceeds the typical eligibility threshold.");
    }
  } else if (turnover === null) {
    eligibility -= 15;
    reasons.push("Add annual turnover to your profile to confirm financial eligibility.");
  }

  if (!company.gstNumber) {
    eligibility -= 20;
    reasons.push("GST registration is required by virtually all government tenders — add your GSTIN.");
  }
  if (company.msmeNumber) {
    reasons.push("MSME registration may grant EMD exemption and price preference.");
    eligibility = Math.min(100, eligibility + 5);
  }

  const mandatoryCount = tender.requirements.filter((r) => r.mandatory).length;
  if (mandatoryCount > 0) {
    reasons.push(`${mandatoryCount} mandatory requirement(s) extracted — verify each before bidding.`);
  }

  eligibility = Math.max(0, Math.min(100, eligibility));

  // --- Win probability: blend, dampened (no outcome history at MVP) ---
  const winProbability = Math.max(
    5,
    Math.min(90, Math.round(matchScore * 0.45 + eligibility * 0.35)),
  );

  return { matchScore, eligibilityScore: eligibility, winProbability, reasons };
}
