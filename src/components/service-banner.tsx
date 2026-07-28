import { AlertTriangle } from "lucide-react";

/**
 * Shown when the database is unreachable. The app keeps rendering during an
 * outage (reads fall back to empty), so without this a user sees a working app
 * with all their data missing — which reads as "my data was deleted" rather
 * than "this is temporary". Says so plainly instead.
 */
export function ServiceBanner() {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="text-sm">
        <p className="font-semibold text-amber-900">
          We&rsquo;re having a temporary problem loading your data
        </p>
        <p className="mt-1 text-amber-800">
          Your company profile, tenders and proposals are safe — this is a connection issue on
          our side, not lost data. Anything shown as empty or missing right now should reappear
          once the connection is restored. Please avoid re-entering details until then. If this
          persists, email{" "}
          <a href="mailto:support@tendercopilot.in" className="font-semibold underline">
            support@tendercopilot.in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
