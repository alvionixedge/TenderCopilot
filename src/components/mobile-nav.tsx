"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

/**
 * Mobile navigation drawer. The desktop sidebar is hidden below `md`, so this
 * is the only way to reach Company/Billing/Settings and Sign out on a phone.
 * Icons live in the (server) layout and can't cross the client boundary, so we
 * pass plain {href,label} strings and render text links.
 */
export function MobileNav({
  items,
  showOps,
  userName,
  plan,
  signOutAction,
}: {
  items: { href: string; label: string }[];
  showOps: boolean;
  userName: string;
  plan: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{userName}</div>
                <div className="text-xs uppercase tracking-wide text-brand-600">{plan} plan</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                >
                  {item.label}
                </Link>
              ))}
              {showOps && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Ops
                </Link>
              )}
            </nav>

            <div className="border-t border-slate-200 p-4">
              <a
                href="mailto:support@tendercopilot.in"
                className="mb-3 block rounded-lg px-1 py-1 text-sm font-medium text-slate-600 hover:text-brand-700"
              >
                Help &amp; support — support@tendercopilot.in
              </a>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
