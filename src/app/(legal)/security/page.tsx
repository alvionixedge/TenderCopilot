import { H2, LegalTitle, Note, P, UL } from "@/components/legal";

export const metadata = { title: "Data & Security Policy" };

const UPDATED = "July 2026";

export default function SecurityPolicy() {
  return (
    <>
      <LegalTitle updated={UPDATED}>Data Storage &amp; Security Policy</LegalTitle>

      <P>
        This policy describes where and how TenderCopilot AI stores your data, how credentials are
        protected, and the security controls in place. It complements our{" "}
        <a href="/privacy" className="text-brand-700 hover:underline">Privacy Policy</a>.
      </P>

      <H2>1. Cloud-only storage</H2>
      <P>
        TenderCopilot AI runs entirely on managed cloud platforms. There is no on-premise or
        local-machine deployment that serves users or holds production data. Your data lives only
        in:
      </P>
      <UL>
        <li><strong>Database — Neon (PostgreSQL):</strong> account, company profile, tenders, scores, proposals, pipeline and billing records. Encrypted at rest and in transit (TLS).</li>
        <li><strong>Object storage — Cloudflare R2:</strong> uploaded documents, stored in a private bucket with no public access. Encrypted at rest.</li>
        <li><strong>Compute/CDN — Vercel:</strong> runs the application; static assets served from the edge.</li>
      </UL>

      <H2>2. Password storage</H2>
      <Note>
        We never store your password. When you register with email and password, your password is
        transformed with <strong>scrypt</strong>, a slow, memory-hard hashing algorithm, using a
        unique random salt per user. Only the resulting hash and salt are stored.
      </Note>
      <UL>
        <li>Passwords are hashed server-side; the raw password is never written to disk or logs.</li>
        <li>Each user has a unique random salt, so identical passwords produce different hashes.</li>
        <li>Password verification uses a constant-time comparison to resist timing attacks.</li>
        <li>Minimum policy: at least 8 characters including a letter and a number.</li>
        <li>If you sign in with Google or Microsoft, no password is stored at all — authentication is delegated to that provider via OAuth 2.0 / OpenID Connect.</li>
      </UL>

      <H2>3. Username / identity storage</H2>
      <P>
        Your identity is your email address, which is stored as a unique record. Your display name
        and (for OAuth) profile image are stored to personalise the app. We do not store
        government IDs as your login identity; GSTIN/PAN are stored only as business profile fields
        for eligibility checks, not as credentials.
      </P>

      <H2>4. Encryption</H2>
      <UL>
        <li><strong>In transit:</strong> TLS 1.2+ is enforced end-to-end across the app, database, and storage.</li>
        <li><strong>At rest:</strong> the database and object storage encrypt data at rest by default.</li>
        <li><strong>Secrets:</strong> API keys and provider credentials live only in the hosting platform&rsquo;s encrypted environment store — never in the codebase, never shipped to your browser, never logged.</li>
      </UL>

      <H2>5. Access to documents</H2>
      <P>
        Uploaded documents are private. They are never publicly addressable. When you upload or
        download a file, the server issues a short-lived, single-purpose pre-signed URL (valid for
        at most five minutes) scoped to that one object. Files are stored under non-guessable,
        tenant-prefixed keys.
      </P>

      <H2>6. Tenant isolation</H2>
      <P>
        Every record is scoped to your organization. Authorization is re-checked server-side on
        every request from your authenticated session — the identifier of your company is derived
        from your session, never from client input — which prevents one customer from accessing
        another&rsquo;s data.
      </P>

      <H2>7. Authentication &amp; sessions</H2>
      <UL>
        <li>Sign-in via Google, Microsoft, or first-party email/password.</li>
        <li>Sessions use signed, HTTP-only, Secure cookies with a short lifetime.</li>
        <li>AI-invoking endpoints are rate-limited to prevent abuse.</li>
      </UL>

      <H2>8. Audit logging</H2>
      <P>
        Significant actions — document access, proposal generation, outcome recording, account
        changes — are recorded in an append-only audit log for security and accountability.
      </P>

      <H2>9. Payment data</H2>
      <P>
        Payments are processed by Razorpay. Card numbers, UPI IDs and banking credentials are
        entered on Razorpay&rsquo;s secure checkout and are never stored on our systems; we retain
        only the transaction reference and status.
      </P>

      <H2>10. Data deletion</H2>
      <P>
        Deleting your account permanently removes your account and your organization&rsquo;s data
        from the database within the deletion transaction. Backups age out on the platform&rsquo;s
        standard cycle. Deactivation is reversible and retains your data until you sign in again.
      </P>

      <H2>11. Reporting a vulnerability</H2>
      <P>
        If you believe you have found a security issue, please contact{" "}
        <strong>security@tendercopilot.in</strong>. We appreciate responsible disclosure and will
        acknowledge your report promptly.
      </P>
    </>
  );
}
