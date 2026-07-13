/**
 * Profile-completeness gate (spec 4.2). To see the tender feed a company must
 * have the fields that drive matching and eligibility: legal name, GSTIN,
 * annual turnover and a capability statement. Everything else is optional.
 */
export interface RequiredProfile {
  companyName: string | null;
  gstNumber: string | null;
  annualTurnover: string | null;
  description: string | null;
}

/** The four fields required before tenders are shown, in display order. */
export const REQUIRED_PROFILE_FIELDS = [
  "Company name",
  "GSTIN",
  "Annual turnover",
  "Capability statement",
] as const;

/** Returns the human labels of the required fields still missing/empty. */
export function missingRequiredProfileFields(c: RequiredProfile | null): string[] {
  if (!c) return [...REQUIRED_PROFILE_FIELDS];
  const missing: string[] = [];
  if (!c.companyName?.trim()) missing.push("Company name");
  if (!c.gstNumber?.trim()) missing.push("GSTIN");
  if (!c.annualTurnover || Number(c.annualTurnover) <= 0) missing.push("Annual turnover");
  if (!c.description || c.description.trim().length < 10) missing.push("Capability statement");
  return missing;
}
