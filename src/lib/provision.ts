import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations, subscriptions, users } from "@/db/schema";

export interface ProvisionedIdentity {
  userId: string;
  orgId: string;
  role: string;
  plan: string;
}

/**
 * Provisions a user record after first OAuth sign-in (spec 4.1).
 * Idempotent: an existing user resolves to their primary membership.
 * A brand-new user gets an organization (tenant root), an owner
 * membership, and a trial subscription on the free plan.
 */
export async function provisionUser(input: {
  name: string;
  email: string;
  image?: string | null;
}): Promise<ProvisionedIdentity> {
  const d = db();

  const existing = await d.query.users.findFirst({
    where: eq(users.email, input.email),
  });

  if (existing) {
    // Reactivate-on-login: clear any self-deactivation flag when the user
    // successfully authenticates again.
    if (existing.deactivatedAt) {
      await d.update(users).set({ deactivatedAt: null }).where(eq(users.id, existing.id));
    }
    const membership = await d.query.memberships.findFirst({
      where: eq(memberships.userId, existing.id),
    });
    if (membership) {
      const org = await d.query.organizations.findFirst({
        where: eq(organizations.id, membership.orgId),
      });
      return {
        userId: existing.id,
        orgId: membership.orgId,
        role: membership.role,
        plan: org?.plan ?? "free",
      };
    }
    // User exists but has no org (edge case) — fall through to create one.
    const identity = await createOrgFor(existing.id, input.name);
    return identity;
  }

  const [user] = await d
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      emailVerified: new Date(),
      image: input.image ?? null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: input.name, image: input.image ?? null },
    })
    .returning();

  return createOrgFor(user.id, input.name);
}

export async function createOrgFor(
  userId: string,
  displayName: string,
): Promise<ProvisionedIdentity> {
  const d = db();
  const [org] = await d
    .insert(organizations)
    .values({ name: `${displayName}'s organization`, type: "company", plan: "free" })
    .returning();

  await d.insert(memberships).values({
    orgId: org.id,
    userId,
    role: "owner",
    status: "active",
  });

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);
  await d
    .insert(subscriptions)
    .values({ orgId: org.id, plan: "free", status: "trial", trialEndsAt: trialEnds })
    .onConflictDoNothing();

  return { userId, orgId: org.id, role: "owner", plan: "free" };
}
