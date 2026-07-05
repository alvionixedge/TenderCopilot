import type { ReactNode } from "react";

export function LegalTitle({ children, updated }: { children: ReactNode; updated: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900">{children}</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
    </header>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 mb-3 text-xl font-semibold text-slate-900">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-[15px] leading-7 text-slate-700">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mb-4 list-disc space-y-1.5 pl-6 text-[15px] leading-7 text-slate-700">{children}</ul>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-[14px] leading-6 text-brand-900">
      {children}
    </div>
  );
}
