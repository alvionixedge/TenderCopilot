import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { ApiError } from "./api";

/**
 * Resolves the active company for the tenant. company_id is always derived
 * server-side from the session's org — never trusted from client input
 * (spec 5.1, 6.3). MVP: the first company of the org is the active one.
 */
export async function getActiveCompany(orgId: string) {
  const rows = await db()
    .select()
    .from(companies)
    .where(eq(companies.orgId, orgId))
    .limit(1);
  return rows[0] ?? null;
}

/** Asserts the company belongs to the caller's org (anti-IDOR re-check). */
export async function assertCompanyInOrg(orgId: string, companyId: string) {
  const rows = await db()
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.orgId, orgId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError("forbidden", 403, "Company does not belong to your organization.");
  }
}
