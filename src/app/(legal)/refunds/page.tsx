import { H2, LegalTitle, Note, P, UL } from "@/components/legal";

export const metadata = { title: "Refund & Cancellation Policy" };

const UPDATED = "July 2026";

export default function RefundsPolicy() {
  return (
    <>
      <LegalTitle updated={UPDATED}>Refund &amp; Cancellation Policy</LegalTitle>

      <P>
        This policy explains how cancellations and refunds work for paid TenderCopilot AI
        subscriptions. It applies alongside our{" "}
        <a href="/terms" className="text-brand-700 hover:underline">Terms of Service</a>.
      </P>

      <Note>
        <strong>In short:</strong> you can cancel at any time, and you will not be charged again.
        Amounts already paid are non-refundable, and your plan stays active until the end of the
        period you have already paid for.
      </Note>

      <H2>1. Cancelling your subscription</H2>
      <UL>
        <li>You can cancel at any time from <strong>Settings → Billing</strong> in the app, or by emailing <strong>support@tendercopilot.in</strong>.</li>
        <li>Cancellation stops all future charges. For recurring subscriptions, no further renewal is billed.</li>
        <li>Your paid features remain active until the end of the current billing period. After that, your organization moves to the Free plan.</li>
      </UL>

      <H2>2. Refunds</H2>
      <UL>
        <li><strong>Subscription fees already paid are non-refundable</strong>, including for any unused portion of the current billing period.</li>
        <li>One-time monthly payments are non-refundable once the billing period has started.</li>
        <li>Because you can cancel any time before the next renewal, you are only ever billed for periods you chose to start.</li>
      </UL>

      <H2>3. Limited exceptions</H2>
      <P>
        We will review and, where appropriate, refund the following, at our discretion or where
        required by law:
      </P>
      <UL>
        <li><strong>Duplicate or erroneous charges</strong> — e.g. you were billed twice for the same period.</li>
        <li><strong>Proven billing errors</strong> on our side.</li>
        <li>Any refund the law specifically requires us to make.</li>
      </UL>
      <P>
        Approved refunds are returned to the original payment method via our payment processor
        (Razorpay). Processing typically takes 5&ndash;7 business days depending on your bank.
      </P>

      <H2>4. Failed or reversed payments</H2>
      <P>
        If a renewal payment fails or a payment is reversed, your plan may be downgraded to Free
        until payment is resolved. This is not a charge and requires no refund.
      </P>

      <H2>5. Taxes</H2>
      <P>
        Where a refund is issued, any applicable GST is handled in accordance with tax rules; the
        refunded amount reflects the net position required by law.
      </P>

      <H2>6. Contact</H2>
      <P>
        Questions about a charge, cancellation, or refund: <strong>support@tendercopilot.in</strong>.
      </P>
    </>
  );
}
