"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export function CredentialsForm({
  initialEmail,
  initialMode,
}: {
  initialEmail?: string;
  initialMode?: "signin" | "signup";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    try {
      if (mode === "signup") {
        const res = await fetch("/api/v1/account/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error?.message ?? "Could not create your account.");
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        throw new Error(
          mode === "signup"
            ? "Account created, but automatic sign-in failed. Please sign in."
            : "Incorrect email or password.",
        );
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <div>
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "signup" && (
          <input name="name" required minLength={2} placeholder="Full name" className={field} />
        )}
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={initialEmail}
          placeholder="you@company.com"
          className={field}
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "Create a password (min 8 chars)" : "Password"}
          className={field}
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-3 text-center text-sm text-slate-600">
        {mode === "signup" ? "Already have an account?" : "New to TenderCopilot?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
          className="font-semibold text-brand-700 hover:underline"
        >
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
