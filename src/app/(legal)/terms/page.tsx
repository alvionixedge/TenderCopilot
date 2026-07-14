import { H2, LegalTitle, P, UL } from "@/components/legal";

export const metadata = { title: "Terms of Service" };

const UPDATED = "July 2026";

export default function TermsOfService() {
  return (
    <>
      <LegalTitle updated={UPDATED}>Terms of Service</LegalTitle>

      <P>
        These Terms govern your use of TenderCopilot AI. By creating an account or using the
        service you agree to them. If you are using the service on behalf of an organization, you
        represent that you are authorised to bind that organization.
      </P>

      <H2>1. The service</H2>
      <P>
        TenderCopilot AI helps you discover public-sector tenders, assess eligibility, generate
        draft proposals, and track bids. It is a decision-support and drafting tool. Outputs —
        scores, eligibility assessments, and generated proposals — are AI-assisted and may contain
        errors or omissions.
      </P>

      <H2>2. Your responsibilities</H2>
      <UL>
        <li>Provide accurate company information and keep your credentials secure.</li>
        <li>Review every AI-generated score and proposal before relying on or submitting it. You are solely responsible for the accuracy, completeness, and compliance of anything you submit to a tendering authority.</li>
        <li>Only upload documents you are entitled to use, and do not upload unlawful content.</li>
        <li>Comply with the rules of the procurement portals and authorities you bid to.</li>
      </UL>

      <H2>3. Acceptable use</H2>
      <P>
        Do not misuse the service: no attempts to breach security or tenant isolation, no scraping
        or overloading the platform, no reverse engineering, and no use that violates applicable
        law.
      </P>

      <H2>4. Plans, billing &amp; taxes</H2>
      <UL>
        <li>Paid plans are billed in INR via Razorpay, either as one-time monthly payments or recurring subscriptions, as you choose.</li>
        <li>Usage limits apply per plan (for example, the number of company profiles and proposals per month).</li>
        <li>Applicable GST is added as required. Recurring subscriptions renew until cancelled.</li>
        <li>Except where required by law, payments are non-refundable once the service for the period has been provided.</li>
      </UL>

      <H2>5. Intellectual property</H2>
      <P>
        You retain ownership of your company data, uploaded documents, and the proposals generated
        for you. You grant us a limited licence to process this content solely to provide the
        service. We retain ownership of the platform, software, and aggregated, de-identified
        analytics that do not identify you.
      </P>

      <H2>6. AI disclaimer</H2>
      <P>
        AI outputs are provided &ldquo;as is&rdquo; and are not legal, financial, or professional
        advice. Government tenders carry strict eligibility and compliance requirements; always
        verify mandatory criteria and figures against the official tender document before bidding.
      </P>

      <H2>7. Availability</H2>
      <P>
        We aim for high availability but the service is provided without a guarantee of
        uninterrupted operation. We may modify or discontinue features with reasonable notice.
      </P>

      <H2>8. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, TenderCopilot AI is not liable for indirect or
        consequential losses, including lost bids, lost profits, or contract awards not won. Our
        total liability for any claim is limited to the fees you paid in the three months preceding
        the claim.
      </P>

      <H2>9. Termination</H2>
      <P>
        You may deactivate or delete your account at any time from Settings. We may suspend or
        terminate accounts that violate these Terms. On deletion, your data is removed as described
        in the{" "}
        <a href="/privacy" className="text-brand-700 hover:underline">Privacy Policy</a>.
      </P>

      <H2>10. Governing law</H2>
      <P>
        These Terms are governed by the laws of India, and disputes are subject to the exclusive
        jurisdiction of the courts at the seat of our registered office.
      </P>

      <H2>11. Contact</H2>
      <P>Questions about these Terms: <strong>support@tendercopilot.in</strong>.</P>
    </>
  );
}
