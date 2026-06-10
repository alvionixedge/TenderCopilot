"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText, KanbanSquare, Loader2, Sparkles } from "lucide-react";

async function post(url: string, body?: unknown, method = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return json;
}

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    fn()
      .then(() => startTransition(() => router.refresh()))
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return { run, busy: busy || pending, error };
}

export function AnalyzeButton({ tenderId, small }: { tenderId: string; small?: boolean }) {
  const { run, busy, error } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        onClick={() => run(() => post(`/api/v1/tenders/${tenderId}/analyze`, {}))}
        className={`inline-flex items-center gap-2 rounded-lg bg-brand-700 font-semibold text-white hover:bg-brand-800 disabled:opacity-60 ${
          small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? "Scoring…" : "Analyze fit"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

export function GenerateProposalButton({ tenderId }: { tenderId: string }) {
  const { run, busy, error } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        onClick={() => run(() => post("/api/v1/proposals", { tenderId, format: "docx" }))}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-700 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {busy ? "Generating… (up to a minute)" : "Generate proposal"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

export function AddToPipelineButton({ tenderId }: { tenderId: string }) {
  const { run, busy, error } = useAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        disabled={busy}
        onClick={() => run(() => post("/api/v1/opportunities", { tenderId }))}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KanbanSquare className="h-4 w-4" />}
        Add to pipeline
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}

export function StageMover({
  opportunityId,
  version,
  currentStage,
  stages,
}: {
  opportunityId: string;
  version: number;
  currentStage: string;
  stages: string[];
}) {
  const { run, busy, error } = useAction();
  return (
    <span className="flex flex-col gap-1">
      <select
        disabled={busy}
        value={currentStage}
        onChange={(e) =>
          run(() =>
            post(
              `/api/v1/opportunities/${opportunityId}`,
              { stage: e.target.value, expectedVersion: version },
              "PATCH",
            ),
          )
        }
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
      >
        {stages.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
