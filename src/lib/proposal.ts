import { generateWithTrace, isAiConfigured } from "./ai";

export interface ProposalContext {
  orgId: string;
  company: {
    companyName: string;
    description: string | null;
    gstNumber: string | null;
    panNumber: string | null;
    msmeNumber: string | null;
    annualTurnover: string | null;
    employeeCount: number | null;
    website: string | null;
  };
  tender: {
    title: string;
    department: string | null;
    source: string;
    estimatedValue: string | null;
    emd: string | null;
    submissionDate: Date | null;
  };
  requirements: { requirement: string; mandatory: boolean; category: string | null }[];
}

export interface GeneratedProposal {
  contentMd: string;
  completeness: number;
  traceId: string | null;
}

// Proposals are the flagship, low-frequency output where quality matters most,
// so they run on a stronger model than the cost-optimized default used for
// scoring. Override with ANTHROPIC_PROPOSAL_MODEL (e.g. claude-opus-4-8 for max
// quality, or claude-haiku-4-5 to minimize cost).
const PROPOSAL_MODEL = process.env.ANTHROPIC_PROPOSAL_MODEL || "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a senior bid writer for Indian government and PSU procurement with 15+ years of experience winning competitive tenders. You draft complete, formal, submission-ready proposals in Markdown.

Rules:
- Write substantive, SPECIFIC content — never generic boilerplate. Tailor every section to THIS tender's scope and THIS company's stated capabilities; refer to the actual work, issuing department and requirements by name.
- Use ## for section headings and Markdown tables where they aid clarity (compliance matrix, company particulars).
- The Compliance Matrix must map EVERY extracted requirement to a specific, credible response — never a blanket "Complied".
- Ground the Technical Approach in the company's real capability statement. If the company is clearly a poor fit for the tender's domain, still produce a professional document but keep every claim honest — do not overstate capability.
- Never fabricate certificates, registration numbers, turnover figures, or past-project names that were not provided. Where a supporting document is needed, reference it as "(Annexure X)".
- Include 1–2 genuine win themes / differentiators drawn only from the provided company profile.
- Write in clear, formal English suited to Indian public procurement — persuasive but factual.`;

/**
 * Generates the proposal body. Uses Claude when configured (spec 2.2);
 * otherwise falls back to a deterministic compliance template so the
 * product remains demonstrable with zero AI spend.
 */
export async function generateProposal(ctx: ProposalContext): Promise<GeneratedProposal> {
  if (isAiConfigured()) {
    // Provider failure (bad/absent credit, invalid key, quota, timeout) must
    // never hard-fail generation — fall back to the deterministic template
    // instead of leaving the user without output (spec §6.2).
    try {
      const userPrompt = buildPrompt(ctx);
      const { text, traceId } = await generateWithTrace({
        orgId: ctx.orgId,
        purpose: "proposal",
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        model: PROPOSAL_MODEL,
        maxTokens: 12000,
      });
      if (text && text.trim().length > 0) {
        return { contentMd: text, completeness: estimateCompleteness(text, ctx), traceId };
      }
      console.error("[proposal] AI returned empty content — using template fallback");
    } catch (err) {
      console.error("[proposal] AI generation failed — using template fallback", err);
    }
  }
  const contentMd = templateProposal(ctx);
  return { contentMd, completeness: estimateCompleteness(contentMd, ctx), traceId: null };
}

function buildPrompt(ctx: ProposalContext): string {
  const reqList = ctx.requirements
    .map((r) => `- [${r.mandatory ? "MANDATORY" : "optional"}]${r.category ? ` (${r.category})` : ""} ${r.requirement}`)
    .join("\n");
  return [
    `Draft a full tender proposal for the following bid.`,
    ``,
    `## Tender`,
    `Title: ${ctx.tender.title}`,
    `Issuing department: ${ctx.tender.department ?? "Not stated"}`,
    `Portal: ${ctx.tender.source}`,
    `Estimated value: ${ctx.tender.estimatedValue ? `INR ${ctx.tender.estimatedValue}` : "Not stated"}`,
    `EMD: ${ctx.tender.emd ? `INR ${ctx.tender.emd}` : "Not stated"}`,
    `Submission deadline: ${ctx.tender.submissionDate?.toISOString() ?? "Not stated"}`,
    ``,
    `## Extracted requirements`,
    reqList || "- None extracted; produce a standard compliance structure.",
    ``,
    `## Bidding company`,
    `Name: ${ctx.company.companyName}`,
    `Profile: ${ctx.company.description ?? "Not provided"}`,
    `GSTIN: ${ctx.company.gstNumber ?? "Not provided"}`,
    `PAN: ${ctx.company.panNumber ?? "Not provided"}`,
    `MSME/Udyam: ${ctx.company.msmeNumber ?? "Not provided"}`,
    `Annual turnover: ${ctx.company.annualTurnover ? `INR ${ctx.company.annualTurnover}` : "Not provided"}`,
    `Employees: ${ctx.company.employeeCount ?? "Not provided"}`,
    ``,
    `Write a complete, submission-ready proposal. Each section must be substantive and specific to THIS tender — not generic boilerplate:`,
    `1. Cover Letter — addressed to the issuing department, quoting the tender title and reference number.`,
    `2. Executive Summary — why this company is a credible bidder for THIS exact scope.`,
    `3. Company Profile — a particulars table plus a short narrative tying the company to the tender's domain.`,
    `4. Understanding of Requirements — restate the scope in your own words to show you have read it.`,
    `5. Technical Approach & Methodology — a phased, tender-specific plan grounded in the company's capability statement, with concrete deliverables, timeline and quality assurance.`,
    `6. Compliance Matrix — a Markdown table mapping EVERY requirement listed above to a specific response and its supporting annexure.`,
    `7. Commercial Terms Note — reference the two-bid system and EMD; do NOT invent prices.`,
    `8. Declarations — standard non-blacklisting and correctness declarations.`,
    `9. Annexure List.`,
    ``,
    `Produce a thorough, professional document. Do not fabricate any specifics that were not provided above.`,
  ].join("\n");
}

function templateProposal(ctx: ProposalContext): string {
  const today = new Date().toISOString().slice(0, 10);
  const compliance = ctx.requirements.length
    ? ctx.requirements
        .map(
          (r) =>
            `| ${r.requirement} | ${r.mandatory ? "Mandatory" : "Optional"} | Complied — see annexures |`,
        )
        .join("\n")
    : "| Standard tender terms | Mandatory | Complied |";

  return `## Cover Letter

Date: ${today}

To,
${ctx.tender.department ?? "The Tendering Authority"}

Subject: Submission of bid for "${ctx.tender.title}"

Respected Sir/Madam,

We, **${ctx.company.companyName}**, hereby submit our bid for the captioned tender published on ${ctx.tender.source}. We confirm unconditional acceptance of the tender terms and conditions and enclose all qualifying documents as annexures.

## Executive Summary

${ctx.company.companyName} is pleased to offer a fully compliant solution for this requirement.${ctx.company.description ? ` ${ctx.company.description}` : ""}

## Company Profile

| Field | Detail |
|---|---|
| Legal name | ${ctx.company.companyName} |
| GSTIN | ${ctx.company.gstNumber ?? "Annexure A"} |
| PAN | ${ctx.company.panNumber ?? "Annexure B"} |
| MSME / Udyam | ${ctx.company.msmeNumber ?? "Not applicable"} |
| Annual turnover | ${ctx.company.annualTurnover ? `INR ${ctx.company.annualTurnover}` : "Annexure C (audited financials)"} |
| Employees | ${ctx.company.employeeCount ?? "—"} |

## Understanding of Requirements

We have studied the tender document in full and understand the scope, timelines, and compliance obligations stated therein.

## Technical Approach & Methodology

Our delivery follows a phased methodology: mobilisation, execution against the technical specification, quality assurance, and handover with documentation, supported by a named project manager and an escalation matrix.

## Compliance Matrix

| Requirement | Type | Our Response |
|---|---|---|
${compliance}

## Commercial Terms

The commercial bid is submitted separately as per the tender's two-bid system.${ctx.tender.emd ? ` EMD of INR ${ctx.tender.emd} is enclosed as prescribed.` : ""}

## Declarations

We declare that we have not been blacklisted by any government department, that the information furnished is true, and that we accept all tender terms unconditionally.

## Annexure List

1. Annexure A — GST Registration Certificate
2. Annexure B — PAN Card
3. Annexure C — Audited Financial Statements
4. Annexure D — Relevant Certifications & Case Studies

For **${ctx.company.companyName}**

Authorised Signatory`;
}

function estimateCompleteness(text: string, ctx: ProposalContext): number {
  let score = 40;
  const sections = ["cover", "summary", "profile", "compliance", "declaration"];
  for (const s of sections) if (text.toLowerCase().includes(s)) score += 8;
  if (ctx.company.gstNumber) score += 5;
  if (ctx.company.annualTurnover) score += 5;
  if (ctx.requirements.length > 0) score += 10;
  return Math.min(100, score);
}
