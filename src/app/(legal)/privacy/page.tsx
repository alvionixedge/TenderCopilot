import { H2, LegalTitle, Note, P, UL } from "@/components/legal";

export const metadata = { title: "Privacy Policy" };

const UPDATED = "July 2026";

export default function PrivacyPolicy() {
  return (
    <>
      <LegalTitle updated={UPDATED}>Privacy Policy</LegalTitle>

      <P>
        This Privacy Policy explains what information TenderCopilot AI (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects, why we collect it, how we use and store it, and the choices
        you have. It is written for our users in India and reflects the principles of the Digital
        Personal Data Protection Act, 2023 (DPDP Act).
      </P>

      <H2>1. Who we are</H2>
      <P>
        TenderCopilot AI is an AI-assisted procurement and bid-management platform. We act as the
        data fiduciary for account and profile data you provide, and as a data processor for the
        tender and proposal content you generate within the product.
      </P>

      <H2>2. Information we collect</H2>
      <UL>
        <li>
          <strong>Account data:</strong> your name and email address. If you sign in with Google or
          Microsoft, we receive your name, email, and profile image from that provider. If you
          register with email and password, we store your email and a one-way hash of your
          password (never the password itself — see our{" "}
          <a href="/security" className="text-brand-700 hover:underline">Data &amp; Security Policy</a>).
        </li>
        <li>
          <strong>Company profile data:</strong> business details you enter — legal name, GSTIN,
          PAN, MSME/Udyam number, turnover, capability description — and documents you upload (GST,
          PAN, certifications, financials, case studies).
        </li>
        <li>
          <strong>Product data:</strong> tenders you analyze, match and eligibility scores,
          generated proposals, CRM pipeline entries, and win/loss outcomes you record.
        </li>
        <li>
          <strong>Billing data:</strong> subscription status and payment events. Card/UPI details
          are handled by our payment processor (Razorpay) and are never stored on our systems.
        </li>
        <li>
          <strong>Lead data (free checker):</strong> our public tender-eligibility checker does
          not store what you type unless you enter your email. If you do, we store your email and
          that check&rsquo;s details to send you matching tenders. You can ask us to delete this at
          any time; it is also removed if you create and then delete an account with the same
          email.
        </li>
        <li>
          <strong>Technical data:</strong> session information, IP address in audit logs, and
          error/usage telemetry used to keep the service secure and reliable.
        </li>
      </UL>

      <H2>3. How we use your information</H2>
      <UL>
        <li>To provide the core service: matching tenders, scoring eligibility, and generating proposals against your company profile.</li>
        <li>To authenticate you and keep your account secure.</li>
        <li>To process subscriptions and issue receipts.</li>
        <li>To maintain an audit trail of significant actions for security and compliance.</li>
        <li>To improve reliability and troubleshoot problems.</li>
      </UL>
      <Note>
        We do <strong>not</strong> sell your personal data, and we do not use your confidential
        company documents or generated proposals to train third-party AI models. Document text is
        sent to our AI providers only as needed to produce your own outputs, fenced strictly as
        data.
      </Note>

      <H2>4. AI processing</H2>
      <P>
        To score tenders and draft proposals, relevant text is sent to AI providers (Anthropic
        Claude, and OpenAI for embeddings/fallback) over encrypted connections and processed on
        your behalf. We minimise what is sent — documents are chunked and only the relevant
        sections are used. Each AI generation is logged for explainability (model, prompt version,
        token counts), without exposing your data to other customers.
      </P>

      <H2>5. Where your data is stored</H2>
      <P>
        Your data is stored only in managed cloud services — a PostgreSQL database (Neon) and
        private object storage (Cloudflare R2), both encrypted at rest, with compute on Vercel. We
        operate on a cloud-only model; nothing of value is stored on local or self-managed
        machines. See the{" "}
        <a href="/security" className="text-brand-700 hover:underline">Data &amp; Security Policy</a>{" "}
        for detail.
      </P>

      <H2>6. Retention</H2>
      <P>
        We keep your data for as long as your account is active. When you delete your account, we
        permanently remove your account and your organization&rsquo;s data (see Section 8).
        Statutory records such as GST tax invoices may be retained for the period required by law.
        Documents that lapse (e.g. expired certifications) are flagged and can be purged.
      </P>

      <H2>7. Sharing</H2>
      <P>
        We share data only with the sub-processors that run the service — cloud hosting (Vercel),
        database (Neon), storage (Cloudflare R2), AI providers (Anthropic, OpenAI), email (Resend),
        and payments (Razorpay) — each under contractual confidentiality and security obligations,
        and only to the extent needed to operate TenderCopilot AI. We may disclose data where
        required by law.
      </P>

      <H2>8. Your rights and choices</H2>
      <UL>
        <li><strong>Access &amp; correction:</strong> view and edit your profile at any time in the app.</li>
        <li><strong>Deactivation:</strong> temporarily disable your account from Settings → Danger zone; it reactivates when you sign in again.</li>
        <li><strong>Deletion (Right to be Forgotten):</strong> permanently delete your account and organization data from Settings → Danger zone.</li>
        <li><strong>Grievances:</strong> contact us at the address below and we will respond within the timelines required by the DPDP Act.</li>
      </UL>

      <H2>9. Children</H2>
      <P>The service is intended for businesses and is not directed at individuals under 18.</P>

      <H2>10. Changes &amp; contact</H2>
      <P>
        We may update this policy; material changes will be notified in-product. Questions or
        grievances: <strong>support@tendercopilot.in</strong>.
      </P>
    </>
  );
}
