"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;
function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  scriptPromise ??= new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json;
}

export function UpgradeButton({
  plan,
  mode,
  label,
  variant = "solid",
  userEmail,
}: {
  plan: "pro" | "business";
  mode: "once" | "recurring";
  label: string;
  variant?: "solid" | "outline";
  userEmail?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const ok = await loadCheckout();
      if (!ok) throw new Error("Could not load the payment library. Check your connection.");

      const init = await postJson("/api/v1/billing/checkout", { plan, mode });

      const baseOptions: Record<string, unknown> = {
        key: init.keyId,
        name: "TenderCopilot AI",
        description: `${init.planName} plan — ${mode === "recurring" ? "monthly auto-billing" : "one month"}`,
        theme: { color: "#1e4e79" },
        prefill: userEmail ? { email: userEmail } : undefined,
        modal: {
          ondismiss: () => setBusy(false),
        },
      };

      const options =
        init.mode === "recurring"
          ? {
              ...baseOptions,
              subscription_id: init.subscriptionId,
              handler: async (resp: Record<string, string>) => {
                try {
                  await postJson("/api/v1/billing/verify", {
                    mode: "recurring",
                    plan,
                    razorpay_payment_id: resp.razorpay_payment_id,
                    razorpay_subscription_id: resp.razorpay_subscription_id,
                    razorpay_signature: resp.razorpay_signature,
                  });
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              },
            }
          : {
              ...baseOptions,
              order_id: init.orderId,
              amount: init.amount,
              currency: init.currency,
              handler: async (resp: Record<string, string>) => {
                try {
                  await postJson("/api/v1/billing/verify", {
                    mode: "once",
                    plan,
                    razorpay_order_id: resp.razorpay_order_id,
                    razorpay_payment_id: resp.razorpay_payment_id,
                    razorpay_signature: resp.razorpay_signature,
                  });
                  router.refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              },
            };

      if (!window.Razorpay) throw new Error("Payment library unavailable.");
      new window.Razorpay(options).open();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        onClick={start}
        disabled={busy}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
          variant === "solid"
            ? "bg-brand-700 text-white hover:bg-brand-800"
            : "border border-brand-700 text-brand-700 hover:bg-brand-50"
        }`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
