"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

interface Result {
  matchScore: number;
  eligibilityScore: number;
  winProbability: number;
  reasons: string[];
  verdict: "strong" | "possible" | "weak";
}

function Meter({ label, value }: { label: string; value: number }) {
  const tone = value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{value}/100</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function FreeCheckForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const fd = new FormData(e.currentTarget);
    setEmail(String(fd.get("email") ?? ""));
    try {
      const res = await fetch("/api/v1/free-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: fd.get("companyName") || "",
          capabilities: fd.get("capabilities"),
          annualTurnover: fd.get("annualTurnover") ? Number(fd.get("annualTurnover")) : undefined,
          hasGst: fd.get("hasGst") === "on",
          hasMsme: fd.get("hasMsme") === "on",
          tenderText: fd.get("tenderText"),
          estimatedValue: fd.get("estimatedValue") ? Number(fd.get("estimatedValue")) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not run the check.");
      setResult(json as Result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  if (result) {
    const verdictCopy =
      result.verdict === "strong"
        ? { t: "You look strongly eligible", tone: "text-emerald-700" }
        : result.verdict === "possible"
          ? { t: "You may be eligible — a few gaps to close", tone: "text-amber-700" }
          : { t: "Eligibility looks limited for this tender", tone: "text-rose-700" };
    const signupHref = `/signin${email ? `?email=${encodeURIComponent(email)}` : ""}`;
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-600">Your result</div>
        <h2 className={`mt-1 text-2xl font-bold ${verdictCopy.tone}`}>{verdictCopy.t}</h2>

        <div className="mt-6 space-y-4">
          <Meter label="Eligibility" value={result.eligibilityScore} />
          <Meter label="Capability match" value={result.matchScore} />
          <Meter label="Estimated win probability" value={result.winProbability} />
        </div>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-800">What this is based on</div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {result.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-500">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h3 className="font-semibold text-brand-900">Get the full picture — free</h3>
          <p className="mt-1 text-sm text-brand-800">
            Create your free account to save this check, get a ranked feed of matching tenders,
            and generate a compliance-ready proposal in minutes.
          </p>
          <Link
            href={signupHref}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          onClick={() => setResult(null)}
          className="mt-4 text-sm font-medium text-brand-700 hover:underline"
        >
          ← Check another tender
        </button>

        <p className="mt-6 text-xs text-slate-400">
          This is an indicative estimate to help you prioritise — not a guarantee of eligibility or
          award. Always verify mandatory criteria against the official tender document.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">What does your company do? *</span>
          <textarea
            name="capabilities"
            required
            minLength={10}
            rows={3}
            className={field}
            placeholder="e.g. IT services — web portals, cloud migration and AMC for government departments. ISO 27001 certified, 40 staff."
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Paste the tender (title + key requirements) *
          </span>
          <textarea
            name="tenderText"
            required
            minLength={5}
            rows={4}
            className={field}
            placeholder={"Development and maintenance of citizen services web portal\nCMMI Level 3\nISO 27001\nMin 2 similar govt projects of ₹1 crore+"}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Annual turnover (INR)</span>
            <input name="annualTurnover" type="number" min={0} className={field} placeholder="25000000" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Tender value (INR, if known)</span>
            <input name="estimatedValue" type="number" min={0} className={field} placeholder="32000000" />
          </label>
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="hasGst" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            We have GST registration
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="hasMsme" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            We are MSME / Udyam registered
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Work email <span className="font-normal text-slate-400">(optional — to save your result)</span>
          </span>
          <input name="email" type="email" className={field} placeholder="you@company.com" />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-3 text-base font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        {busy ? "Checking…" : "Check my eligibility — free"}
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        Free, instant, no signup required. We don&apos;t store what you enter here.
      </p>
    </form>
  );
}
