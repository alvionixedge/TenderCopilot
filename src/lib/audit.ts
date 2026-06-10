import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Append-only audit trail (spec 3.15). Failures are logged but never block
 * the user-facing action.
 */
export async function recordAudit(entry: {
  orgId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db().insert(auditLog).values({
      orgId: entry.orgId,
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? null,
      ipAddress: entry.ipAddress ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
