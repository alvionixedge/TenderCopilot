import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CreditCard,
  FileText,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  Radar,
  Settings,
} from "lucide-react";
import { auth, signOut } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { Logo, Mark } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tenders", label: "Tenders", icon: Radar },
  { href: "/proposals", label: "Proposals", icon: FileText },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/company", label: "Company", icon: Building2 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.userId) redirect("/signin");

  const showOps = isAdminUser(session.user?.email);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-800"
            >
              <item.icon className="h-4.5 w-4.5 text-slate-400" />
              {item.label}
            </Link>
          ))}
          {showOps && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Gauge className="h-4.5 w-4.5 text-brand-500" />
              Ops
            </Link>
          )}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <a
            href="mailto:support@tendercopilot.in"
            className="mb-3 flex items-center gap-2 rounded-lg px-1 py-1 text-xs font-medium text-slate-600 hover:text-brand-700"
            title="Email support@tendercopilot.in"
          >
            <LifeBuoy className="h-4 w-4 text-slate-400" />
            Help &amp; support
          </a>
          <div className="mb-3 flex items-center gap-3">
            <Mark size={32} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800">
                {session.user?.name ?? "Member"}
              </div>
              <div className="text-xs uppercase tracking-wide text-brand-600">
                {session.plan} plan
              </div>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
        <Link href="/dashboard">
          <Logo size="sm" />
        </Link>
        <MobileNav
          items={nav.map((n) => ({ href: n.href, label: n.label }))}
          showOps={showOps}
          userName={session.user?.name ?? "Member"}
          plan={session.plan}
          signOutAction={signOutAction}
        />
      </div>

      <main className="flex-1 px-4 pb-16 pt-20 md:ml-60 md:px-8 md:pt-8">{children}</main>
    </div>
  );
}
