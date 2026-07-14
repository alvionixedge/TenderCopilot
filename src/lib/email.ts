import { Resend } from "resend";

/**
 * Transactional email via Resend (spec §2.2). No-op (logged) when
 * RESEND_API_KEY is not configured, so the funnel degrades gracefully.
 */
let client: Resend | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function getClient(): Resend {
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || "TenderCopilot AI <support@tendercopilot.in>";
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://tendercopilot.in";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; skipped?: boolean }> {
  if (!isEmailConfigured()) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${opts.subject}" to ${opts.to}`);
    return { sent: false, skipped: true };
  }
  const { error } = await getClient().emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  if (error) throw new Error(error.message);
  return { sent: true };
}

// --- Shared HTML shell --------------------------------------------------------
export function emailShell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="background:#1e4e79;border-radius:12px 12px 0 0;padding:20px 24px">
      <span style="color:#fff;font-size:18px;font-weight:700">TenderCopilot&nbsp;AI</span>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;padding:24px">
      ${bodyHtml}
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:18px;margin:16px 4px 0">
      You&rsquo;re receiving this because you ran a free eligibility check on TenderCopilot&nbsp;AI.
      <br/><a href="${appUrl()}/privacy" style="color:#94a3b8">Privacy Policy</a>
    </p>
  </div></body></html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  const cta = `${appUrl()}/signin`;
  return {
    subject: "Your tender eligibility check — and what's next",
    html: emailShell(`
      <h1 style="font-size:20px;margin:0 0 12px">Thanks for checking your eligibility${name ? `, ${name}` : ""}!</h1>
      <p style="font-size:15px;line-height:22px;color:#334155;margin:0 0 16px">
        You just saw an instant read on whether that tender is worth your time. That&rsquo;s a
        taste of what TenderCopilot AI does across every open government tender — CPPP, state
        portals and PSUs.
      </p>
      <p style="font-size:15px;line-height:22px;color:#334155;margin:0 0 16px">
        Create your free account to get a <strong>ranked feed of matching tenders</strong>, deeper
        eligibility scoring against your full company profile, and a
        <strong>compliance-ready proposal generated in minutes</strong>.
      </p>
      <a href="${cta}" style="display:inline-block;background:#1e4e79;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">Create my free account →</a>
      <p style="font-size:13px;line-height:20px;color:#64748b;margin:20px 0 0">
        Keep an eye out — a shortlist of tenders matching your capabilities is on its way.
      </p>
    `),
  };
}

export interface MatchLine {
  title: string;
  department: string | null;
  source: string;
  submissionDate: Date | null;
  matchScore: number;
  eligibilityScore: number;
}

export function matchingTendersEmail(matches: MatchLine[]): { subject: string; html: string } {
  const cta = `${appUrl()}/signin`;
  const rows = matches
    .map(
      (m) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9">
          <div style="font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(m.title)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            ${escapeHtml(m.source)}${m.department ? ` · ${escapeHtml(m.department)}` : ""}${
              m.submissionDate
                ? ` · closes ${m.submissionDate.toLocaleDateString("en-IN")}`
                : ""
            }
          </div>
          <div style="font-size:12px;margin-top:6px">
            <span style="background:#ecfdf5;color:#047857;border-radius:999px;padding:2px 8px;font-weight:600">Match ${m.matchScore}</span>
            <span style="background:#eff6ff;color:#1e4e79;border-radius:999px;padding:2px 8px;font-weight:600;margin-left:4px">Eligibility ${m.eligibilityScore}</span>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  return {
    subject: `${matches.length} government tenders matching your capabilities`,
    html: emailShell(`
      <h1 style="font-size:20px;margin:0 0 12px">Tenders that match what you do</h1>
      <p style="font-size:15px;line-height:22px;color:#334155;margin:0 0 8px">
        Based on the capabilities you entered, here are open tenders worth a look:
      </p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <a href="${cta}" style="display:inline-block;margin-top:20px;background:#1e4e79;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">See your full ranked feed →</a>
      <p style="font-size:12px;line-height:18px;color:#94a3b8;margin:16px 0 0">
        Scores are indicative and based on the details you provided — verify mandatory criteria
        against each official tender document before bidding.
      </p>
    `),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
