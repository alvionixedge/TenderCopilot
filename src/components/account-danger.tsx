"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";

export function AccountDanger({ canDelete, deleteBlockedReason }: { canDelete: boolean; deleteBlockedReason?: string }) {
  const [busy, setBusy] = useState<null | "deactivate" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  async function deactivate() {
    if (!confirm("Deactivate your account? You'll be signed out. Signing in again reactivates it.")) return;
    setBusy("deactivate");
    setError(null);
    try {
      const res = await fetch("/api/v1/account/deactivate", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Failed to deactivate.");
      }
      await signOut({ redirectTo: "/" });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function del() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/v1/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Failed to delete account.");
      }
      await signOut({ redirectTo: "/" });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-rose-600" />
        <h2 className="text-lg font-semibold text-rose-900">Danger zone</h2>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">Deactivate account</div>
          <p className="text-sm text-slate-600">
            Temporarily disable your account and sign out. Your data is kept and your account
            reactivates the next time you sign in.
          </p>
        </div>
        <button
          onClick={deactivate}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
        >
          {busy === "deactivate" && <Loader2 className="h-4 w-4 animate-spin" />}
          Deactivate
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-rose-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Delete account</div>
            <p className="text-sm text-slate-600">
              Permanently delete your account and all organization data (companies, documents,
              proposals, pipeline, billing records). This cannot be undone.
            </p>
          </div>
          {!showDelete && (
            <button
              onClick={() => setShowDelete(true)}
              disabled={!canDelete || busy !== null}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Delete…
            </button>
          )}
        </div>

        {!canDelete && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            {deleteBlockedReason ?? "Account deletion is currently unavailable."}
          </p>
        )}

        {showDelete && canDelete && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="block text-sm text-slate-700">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm:
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                placeholder="DELETE"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={del}
                disabled={confirmText !== "DELETE" || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" />}
                Permanently delete my account
              </button>
              <button
                onClick={() => {
                  setShowDelete(false);
                  setConfirmText("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
