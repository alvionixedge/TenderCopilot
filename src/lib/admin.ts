/**
 * Platform super-admin gate for the founder/ops dashboard (/admin).
 * Access is limited to the emails in the ADMIN_EMAILS env var
 * (comma-separated). This is separate from per-org owner/admin roles — an
 * org owner is NOT a platform admin unless their email is allow-listed.
 */
export function isAdminUser(email?: string | null): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
