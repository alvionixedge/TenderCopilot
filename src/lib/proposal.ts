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

const SYSTEM_PROMPT = `You are a senior bid writer for Indian government procurement. You produce complete, formal, compliance-oriented tender proposals in Markdown. Use ## section headings. Never fabricate certificates, registration numbers, or financials that were not provided. Where a supporting document is needed, reference it as an annexure placeholder. Write in clear professional English suited to Indian public procurement.`;

/**
 * Generates the proposal body. Uses Claude when configured (spec 2.2);
 * otherwise falls back to a deterministic compliance template so the
 * product remains demonstrable with zero AI spend.
 */
export async function generateProposal(ctx: ProposalContext): Promise<GeneratedProposal> {
  if (isAiConfigured()) {
    const userPrompt = buildPrompt(ctx);
    const { text, traceId } = await generateWithTrace({
      orgId: ctx.orgId,
      purpose: "proposal",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 8000,
    });
    return { contentMd: text, completeness: estimateCompleteness(text, ctx), traceId };
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
    `Produce these sections: Cover Letter, Executive Summary, Company Profile, Understanding of Requirements, Technical Approach & Methodology, Compliance Matrix (table mapping every mandatory requirement to our response), Commercial Terms Note, Declarations, and Annexure List.`,
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
