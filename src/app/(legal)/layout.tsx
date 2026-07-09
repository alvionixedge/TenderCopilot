import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-brand-700">Privacy</Link>
            <Link href="/security" className="hover:text-brand-700">Data &amp; Security</Link>
            <Link href="/terms" className="hover:text-brand-700">Terms</Link>
            <Link href="/refunds" className="hover:text-brand-700">Refunds</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        {children}
        <div className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <Link href="/" className="text-brand-700 hover:underline">← Back to TenderCopilot AI</Link>
        </div>
      </main>
    </div>
  );
}
