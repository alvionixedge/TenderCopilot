"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function CancelButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (
      !confirm(
        "Cancel your subscription? You won't be charged again. Your plan stays active until the end of the period you've already paid for — no refund is issued for the current period.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/cancel", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "Could not cancel.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <button
        onClick={cancel}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Cancel subscription
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
