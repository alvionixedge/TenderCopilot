import Link from "next/link";
import { CheckCircle2, Clock, Radar, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { FreeCheckForm } from "@/components/free-check-form";

export const metadata = {
  title: "Free tender eligibility check",
  description:
    "Check if your company is eligible for a government tender in 30 seconds — free, instant, no signup. Get your eligibility, capability match, and win-probability scores.",
};

const trust = [
  { icon: Clock, text: "30-second result" },
  { icon: ShieldCheck, text: "No signup required" },
  { icon: Radar, text: "GeM · CPPP · state · PSU" },
];

export default function FreeCheckPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link
            href="/signin"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-2 lg:py-16">
        {/* Pitch */}
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
            FREE ELIGIBILITY CHECK
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
            Should you bid on that tender?
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Paste any government tender and your company details. In 30 seconds you&apos;ll see
            your eligibility, how well your capabilities match, and an estimated win probability —
            before you spend a rupee or an evening on the bid.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Instant eligibility & win-probability scoring",
              "Clear, itemised reasons — see exactly what helps or hurts",
              "Built for Indian SMBs, MSMEs and bid consultants",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            {trust.map((t) => (
              <div key={t.text} className="inline-flex items-center gap-2 text-sm text-slate-500">
                <t.icon className="h-4 w-4 text-brand-600" />
                {t.text}
              </div>
            ))}
          </div>
        </div>

        {/* Checker */}
        <div>
          <FreeCheckForm />
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} TenderCopilot AI</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-brand-700">Privacy</Link>
            <Link href="/security" className="hover:text-brand-700">Data &amp; Security</Link>
            <Link href="/terms" className="hover:text-brand-700">Terms</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
