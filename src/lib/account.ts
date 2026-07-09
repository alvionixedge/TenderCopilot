import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  aiGenerations,
  auditLog,
  bidOutcomes,
  companies,
  companyDocuments,
  invitations,
  jobs,
  leads,
  memberships,
  membershipCompanyAccess,
  notifications,
  opportunities,
  organizations,
  paymentEvents,
  proposals,
  proposalVersions,
  sessions,
  subscriptions,
  tenderMatches,
  usageCounters,
  users,
} from "@/db/schema";
import { ApiError } from "./errors";
import { createOrgFor, type ProvisionedIdentity } from "./provision";
import { hashPassword, validatePasswordStrength } from "./password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registers a first-party email/password account and provisions its
 * organization (deviation from spec §5.1). Idempotency: a duplicate email
 * is rejected rather than silently merged.
 */
export async function registerWithPassword(input: {
  name: string;
  email: string;
  password: string;
}): Promise<ProvisionedIdentity> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!EMAIL_RE.test(email)) throw new ApiError("invalid_email", 422, "Enter a valid email address.");
  if (name.length < 2) throw new ApiError("invalid_name", 422, "Enter your name.");
  const pwError = validatePasswordStrength(input.password);
  if (pwError) throw new ApiError("weak_password", 422, pwError);

  const d = db();
  const existing = await d.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    throw new ApiError(
      "email_taken",
      409,
      "An account with this email already exists. Try signing in instead.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await d
    .insert(users)
    .values({ name, email, passwordHash })
    .returning();

  return createOrgFor(user.id, name);
}

/** Self-deactivation: reversible, cleared automatically on next login. */
export async function deactivateAccount(userId: string): Promise<void> {
  await db().update(users).set({ deactivatedAt: new Date() }).where(eq(users.id, userId));
  await db().delete(sessions).where(eq(sessions.userId, userId));
}

export interface DeletionEligibility {
  canDelete: boolean;
  reason?: string;
}

/**
 * Deletion is allowed only when every organization the user belongs to has
 * no other members — i.e. deleting the user cannot orphan another tenant's
 * data or another member's access. Otherwise the user must transfer
 * ownership / remove members first (surfaced in the UI).
 */
export async function checkDeletionEligibility(userId: string): Promise<DeletionEligibility> {
  const d = db();
  const mems = await d.select().from(memberships).where(eq(memberships.userId, userId));
  for (const m of mems) {
    const others = await d
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.orgId, m.orgId), ne(memberships.userId, userId)))
      .limit(1);
    if (others.length > 0) {
      return {
        canDelete: false,
        reason:
          "You belong to an organization with other members. Transfer ownership or remove the other members before deleting your account.",
      };
    }
  }
  return { canDelete: true };
}

/**
 * Permanent account deletion (RTBF, spec data-retention §8.6). Deletes all
 * data for the solely-owned organizations, then the user, inside a single
 * transaction. Global tenders are shared and are not touched.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const eligibility = await checkDeletionEligibility(userId);
  if (!eligibility.canDelete) {
    throw new ApiError("deletion_blocked", 409, eligibility.reason ?? "Account cannot be deleted.");
  }

  const d = db();
  const account = await d.query.users.findFirst({ where: eq(users.id, userId) });
  const mems = await d.select().from(memberships).where(eq(memberships.userId, userId));
  const orgIds = [...new Set(mems.map((m) => m.orgId))];

  await d.transaction(async (tx) => {
    for (const orgId of orgIds) {
      // Children first, respecting foreign keys.
      const orgProposals = await tx
        .select({ id: proposals.id })
        .from(proposals)
        .where(eq(proposals.orgId, orgId));
      const proposalIds = orgProposals.map((p) => p.id);
      if (proposalIds.length > 0) {
        await tx.delete(proposalVersions).where(inArray(proposalVersions.proposalId, proposalIds));
      }

      const orgCompanies = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.orgId, orgId));
      const companyIds = orgCompanies.map((c) => c.id);
      if (companyIds.length > 0) {
        await tx
          .delete(membershipCompanyAccess)
          .where(inArray(membershipCompanyAccess.companyId, companyIds));
      }

      await tx.delete(bidOutcomes).where(eq(bidOutcomes.orgId, orgId));
      await tx.delete(opportunities).where(eq(opportunities.orgId, orgId));
      await tx.delete(proposals).where(eq(proposals.orgId, orgId));
      await tx.delete(tenderMatches).where(eq(tenderMatches.orgId, orgId));
      await tx.delete(companyDocuments).where(eq(companyDocuments.orgId, orgId));
      await tx.delete(companies).where(eq(companies.orgId, orgId));
      await tx.delete(aiGenerations).where(eq(aiGenerations.orgId, orgId));
      await tx.delete(usageCounters).where(eq(usageCounters.orgId, orgId));
      await tx.delete(paymentEvents).where(eq(paymentEvents.orgId, orgId));
      await tx.delete(notifications).where(eq(notifications.orgId, orgId));
      await tx.delete(invitations).where(eq(invitations.orgId, orgId));
      await tx.delete(subscriptions).where(eq(subscriptions.orgId, orgId));
      await tx.delete(auditLog).where(eq(auditLog.orgId, orgId));
      await tx.delete(jobs).where(eq(jobs.orgId, orgId));
      await tx.delete(memberships).where(eq(memberships.orgId, orgId));
      await tx.delete(organizations).where(eq(organizations.id, orgId));
    }

    // Remove any marketing lead captured under the same email (RTBF).
    if (account?.email) {
      await tx.delete(leads).where(eq(leads.email, account.email));
    }
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
