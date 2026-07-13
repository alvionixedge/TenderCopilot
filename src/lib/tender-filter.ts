/**
 * Profile-based filtering for the open-tenders feed (spec 4.3).
 *
 * From the live CPPP data we can filter on two profile signals today:
 *  - capability statement → keyword relevance against the tender text
 *  - annual turnover      → the ~30% financial-eligibility convention, when the
 *                           tender discloses a value
 *
 * MSME/Udyam and employee-count filters need per-tender eligibility fields that
 * CPPP listings don't expose; those arrive with detail-page enrichment.
 *
 * "Filter on what's available": each check is skipped (treated as a pass) when
 * the data needed to judge it is missing, so a partial profile still narrows
 * the feed instead of hiding everything.
 */
import { keywordOverlapScore } from "./scoring";

/** Minimum keyword-relevance for a tender to count as a capability fit. */
export const RELEVANCE_THRESHOLD = 30;

export interface FilterProfile {
  description: string | null;
  annualTurnover: string | null;
  msmeNumber?: string | null;
  employeeCount?: number | null;
}

export interface FilterTender {
  title: string;
  department: string | null;
  estimatedValue: string | null;
  msmeReserved?: boolean | null;
  minEmployees?: number | null;
}

/** 0–100 keyword relevance of a tender to the company's capability statement. */
export function tenderRelevance(profile: FilterProfile, tender: FilterTender): number {
  const tenderText = [tender.title, tender.department ?? ""].join(" ");
  return keywordOverlapScore(profile.description ?? "", tenderText);
}

/**
 * Financial eligibility by the common Indian-procurement convention (bidder
 * turnover ≥ ~30% of estimated value). Returns true (pass) when either figure
 * is unknown — we can't disqualify on data we don't have.
 */
export function turnoverEligible(
  annualTurnover: string | null,
  estimatedValue: string | null,
): boolean {
  const turnover = annualTurnover ? Number(annualTurnover) : null;
  const value = estimatedValue ? Number(estimatedValue) : null;
  if (turnover === null || value === null || Number.isNaN(turnover) || Number.isNaN(value)) {
    return true;
  }
  return turnover >= value * 0.3;
}

/**
 * MSE/MSME reservation: if a tender is reserved for MSME and the company has no
 * Udyam/MSME registration, it can't bid. Unknown reservation (null) → pass.
 */
export function msmeEligible(
  msmeNumber: string | null | undefined,
  msmeReserved: boolean | null | undefined,
): boolean {
  if (!msmeReserved) return true; // not reserved (or unknown) → open to all
  return Boolean(msmeNumber && msmeNumber.trim().length > 0);
}

/**
 * Manpower: if a tender states a minimum staff requirement and the company has
 * fewer employees, it likely fails pre-qualification. Unknown on either side →
 * pass (we don't disqualify on data we don't have).
 */
export function employeesEligible(
  employeeCount: number | null | undefined,
  minEmployees: number | null | undefined,
): boolean {
  if (minEmployees == null || minEmployees <= 0) return true;
  if (employeeCount == null) return true;
  return employeeCount >= minEmployees;
}

/**
 * A tender "fits" when it clears every check for which we have data:
 * capability relevance, turnover, MSME reservation and manpower. Each check
 * passes when its inputs are missing, so a partial profile still narrows.
 */
export function fitsProfile(profile: FilterProfile, tender: FilterTender): boolean {
  return (
    tenderRelevance(profile, tender) >= RELEVANCE_THRESHOLD &&
    turnoverEligible(profile.annualTurnover, tender.estimatedValue) &&
    msmeEligible(profile.msmeNumber, tender.msmeReserved) &&
    employeesEligible(profile.employeeCount, tender.minEmployees)
  );
}
