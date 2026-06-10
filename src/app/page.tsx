import Link from "next/link";
import {
  ArrowRight,
  FileCheck2,
  Gauge,
  KanbanSquare,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  {
    icon: Radar,
    title: "Tender discovery",
    body: "Tenders from GeM, CPPP, state portals and PSUs land in one ranked feed — deduplicated, versioned, and refreshed on schedule.",
  },
  {
    icon: Gauge,
    title: "Match & eligibility scoring",
    body: "Every tender is scored against your company profile: semantic fit, hard eligibility criteria, and an estimated win probability.",
  },
  {
    icon: Sparkles,
    title: "AI proposal generation",
    body: "Generate a complete, compliance-checked proposal in DOCX — cover letter, compliance matrix, declarations and annexures.",
  },
  {
    icon: KanbanSquare,
    title: "Bid pipeline CRM",
    body: "Track every bid from discovery to won/lost on a Kanban pipeline, with outcome capture feeding your win/loss intelligence.",
  },
  {
    icon: ShieldCheck,
    title: "Tenant-isolated by design",
    body: "Organization-scoped data, server-side authorization on every route, private document storage with short-lived signed URLs.",
  },
  {
    icon: FileCheck2,
    title: "Full AI traceability",
    body: "Every score and proposal records the model, prompt version and token usage — explainable AI you can audit later.",
  },
];

const steps = [
  { n: "1", t: "Sign in with Google or Microsoft", b: "No passwords to manage. Your organization is provisioned on first sign-in." },
  { n: "2", t: "Build your company profile", b: "GSTIN, PAN, MSME, turnover and capability statement — the basis for every score." },
  { n: "3", t: "Review your ranked tender feed", b: "Match, eligibility and win-probability scores with AI reasoning per tender." },
  { n: "4", t: "Generate & submit proposals", b: "Compliance-structured DOCX proposals, tracked through your bid pipeline." },
];

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "/month",
    blurb: "Evaluate the full workflow",
    items: ["1 company profile", "20 tenders/day in feed", "3 proposals/month", "Single seat"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹4,999",
    period: "/month",
    blurb: "For active bidding teams",
    items: ["3 company profiles", "Full tender feed", "25 proposals/month", "5 seats", "Priority scoring"],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Business",
    price: "₹14,999",
    period: "/month",
    blurb: "Consultancies & enterprises",
    items: ["25 client companies", "Unlimited proposals", "25 seats", "Win/loss analytics", "Email support"],
    cta: "Contact sales",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo size="sm" />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-brand-700">Features</a>
            <a href="#how" className="hover:text-brand-700">How it works</a>
            <a href="#pricing" className="hover:text-brand-700">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Sign in
            </Link>
            <Link
              href="/signin"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI-POWERED PROCUREMENT & BID MANAGEMENT
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Win more government tenders with{" "}
            <span className="text-brand-600">an AI copilot</span> on your bid desk
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            TenderCopilot AI compresses the entire tender workflow — discovery, eligibility
            scoring, proposal drafting and bid tracking — into one system built for Indian
            SMBs, MSMEs and bid consultants.
          </p>
          <div className="mt-9 flex items-center justify-center gap-4">
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-800"
            >
              Start bidding smarter <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-slate-300 px-6 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              See how it works
            </a>
          </div>
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 text-center">
            {[
              ["GeM · CPPP · PSU", "portals covered"],
              ["< 60 sec", "to a draft proposal"],
              ["0 → 100", "eligibility scoring"],
            ].map(([big, small]) => (
              <div key={small} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-lg font-bold text-brand-700">{big}</div>
                <div className="text-xs text-slate-500">{small}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Everything between tender notice and award letter
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          One platform replaces the spreadsheet, the portal-checking routine, and the
          proposal all-nighter.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <f.icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">How it works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Simple, INR-native pricing
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          Pay with UPI, cards or netbanking via Razorpay. Start free — upgrade when the
          pipeline fills up.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-7 shadow-sm ${
                p.highlight
                  ? "border-brand-600 bg-brand-700 text-white shadow-lg"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className={`text-sm font-semibold ${p.highlight ? "text-brand-100" : "text-brand-700"}`}>
                {p.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className={p.highlight ? "text-brand-200" : "text-slate-500"}>{p.period}</span>
              </div>
              <p className={`mt-1 text-sm ${p.highlight ? "text-brand-100" : "text-slate-600"}`}>{p.blurb}</p>
              <ul className={`mt-6 space-y-2.5 text-sm ${p.highlight ? "text-brand-50" : "text-slate-700"}`}>
                {p.items.map((i) => (
                  <li key={i} className="flex items-start gap-2">
                    <FileCheck2 className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-brand-200" : "text-brand-600"}`} />
                    {i}
                  </li>
                ))}
              </ul>
              <Link
                href="/signin"
                className={`mt-8 block rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${
                  p.highlight
                    ? "bg-white text-brand-800 hover:bg-brand-50"
                    : "bg-brand-700 text-white hover:bg-brand-800"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row">
          <Logo size="sm" />
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} TenderCopilot AI. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
