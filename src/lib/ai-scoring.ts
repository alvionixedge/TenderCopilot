/**
 * AI-driven tender <-> company fit scoring (spec 4.3).
 *
 * Unlike the deterministic heuristic in ./scoring, this asks the model to read
 * the company's capability statement against the tender's actual requirements
 * and return real capability/eligibility/win scores — so a wrong-sector bidder
 * (e.g. a DevOps firm vs an RF-manufacturing tender) is scored low on merit,
 * not just on missing paperwork.
 *
 * The tender text is untrusted (scraped) and is passed as fenced data. Any
 * failure (no key, timeout, malformed output) throws so the caller can fall
 * back to the heuristic — the product must never hard-fail on AI.
 */
import { z } from "zod";
import { generateWithTrace } from "./ai";
import type { CompanyProfileInput, ScoreResult, TenderInput } from "./scoring";

export interface AiScoreResult extends ScoreResult {
  reasoning: string;
  aiTraceId: string | null;
}

const clampScore = z.coerce.number().pipe(z.number()).transform((n) => Math.max(0, Math.min(100, Math.round(n))));

const aiScoreSchema = z.object({
  match: clampScore,
  eligibility: clampScore,
  win: clampScore,
  reasoning: z.string().min(1).max(4000),
});

/**
 * Pulls the JSON object out of a model response that may be wrapped in prose or
 * ```json fences, then validates it. Throws on anything unparseable.
 */
export function parseAiScore(text: string): z.infer<typeof aiScoreSchema> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI scoring response.");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  return aiScoreSchema.parse(parsed);
}

const SYSTEM_PROMPT = [
  "You are a senior bid-qualification analyst for Indian government and PSU tenders.",
  "Assess how well ONE specific company can pursue ONE specific tender, and score three axes from 0 to 100:",
  "- match: technical/domain capability fit. Can this company actually perform this scope given its capability statement? 0 = unrelated sector (e.g. a software firm bidding to manufacture hardware), 100 = specialist with a direct track record.",
  "- eligibility: likelihood it meets the tender's qualifying criteria — the technical experience/certifications implied by the requirements, PLUS financial/registration readiness (annual turnover vs estimated value, GST registration, MSME status). 0 = clearly ineligible, 100 = clearly meets all.",
  "- win: realistic probability of winning if it bids, weighing capability, eligibility and likely competition. A company that cannot technically perform the work MUST score very low here regardless of its paperwork.",
  "Be strict and realistic. Do NOT inflate scores to be encouraging. If the capability statement does not match the tender's domain, match and win must both be low.",
  'Output ONLY a JSON object, no markdown and no surrounding text: {"match": <int>, "eligibility": <int>, "win": <int>, "reasoning": "<3-5 plain-text sentences on fit, key risks, and what to verify before bidding>"}',
].join("\n");

/**
 * Scores a tender against a company using the model. Throws on any failure.
 */
export async function aiScoreTender(
  orgId: string,
  company: CompanyProfileInput,
  tender: TenderInput,
): Promise<AiScoreResult> {
  const turnover = company.annualTurnover ? Number(company.annualTurnover) : null;
  const value = tender.estimatedValue ? Number(tender.estimatedValue) : null;

  const userPrompt = [
    "Company profile:",
    `- Capability statement: ${company.description?.trim() || "(not provided)"}`,
    `- Annual turnover (INR): ${turnover != null ? turnover.toLocaleString("en-IN") : "not provided"}`,
    `- GST registered: ${company.gstNumber ? "yes" : "no"}`,
    `- MSME registered: ${company.msmeNumber ? "yes" : "no"}`,
    `- Employees: ${company.employeeCount ?? "not provided"}`,
    "",
    "Tender:",
    `- Title: ${tender.title}`,
    `- Issuing organisation: ${tender.department ?? "n/a"}`,
    `- Estimated value (INR): ${value != null ? value.toLocaleString("en-IN") : "not disclosed"}`,
    `- EMD (INR): ${tender.emd ?? "not disclosed"}`,
    "",
    "The tender's extracted requirements are in the fenced data below. Score the fit now.",
  ].join("\n");

  const fencedData =
    tender.requirements.length > 0
      ? tender.requirements
          .map((r) => `- ${r.mandatory ? "[mandatory] " : ""}${r.requirement}`)
          .join("\n")
      : "(no structured requirements extracted — judge from the title and organisation)";

  const ai = await generateWithTrace({
    orgId,
    purpose: "score",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    fencedData,
    maxTokens: 700,
    temperature: 0.1,
  });

  const scored = parseAiScore(ai.text);

  return {
    matchScore: scored.match,
    eligibilityScore: scored.eligibility,
    winProbability: scored.win,
    reasons: [scored.reasoning],
    reasoning: scored.reasoning,
    aiTraceId: ai.traceId,
  };
}
