import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, configuredProviders, credentialsEnabled, signIn } from "@/auth";
import { CredentialsForm } from "@/components/credentials-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await auth();
  if (session?.userId) redirect("/dashboard");

  const { email } = await searchParams;
  const prefillEmail = typeof email === "string" ? email : undefined;

  const hasGoogle = configuredProviders.includes("google");
  const hasMicrosoft = configuredProviders.includes("microsoft-entra-id");
  const hasOAuth = hasGoogle || hasMicrosoft;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-center text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-center text-sm text-slate-600">
            Sign in with your work account. Your organization is created automatically on
            first sign-in.
          </p>

          <div className="mt-8 space-y-3">
            {hasGoogle && (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/dashboard" });
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.16-3.16A10.97 10.97 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                  </svg>
                  Continue with Google
                </button>
              </form>
            )}
            {hasMicrosoft && (
              <form
                action={async () => {
                  "use server";
                  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
                }}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 23 23" aria-hidden>
                    <rect width="10" height="10" x="1" y="1" fill="#f25022" />
                    <rect width="10" height="10" x="12" y="1" fill="#7fba00" />
                    <rect width="10" height="10" x="1" y="12" fill="#00a4ef" />
                    <rect width="10" height="10" x="12" y="12" fill="#ffb900" />
                  </svg>
                  Continue with Microsoft
                </button>
              </form>
            )}
            {!hasOAuth && !credentialsEnabled && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                <strong>Sign-in is not configured yet.</strong> Set{" "}
                <code className="font-mono text-xs">AUTH_SECRET</code> plus{" "}
                <code className="font-mono text-xs">DATABASE_URL</code> (for email/password)
                and/or the OAuth variables in the Vercel environment settings, then redeploy.
              </div>
            )}
          </div>

          {hasOAuth && credentialsEnabled && (
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                or with email
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          )}

          {credentialsEnabled && (
            <CredentialsForm
              initialEmail={prefillEmail}
              initialMode={prefillEmail ? "signup" : "signin"}
            />
          )}

          <p className="mt-8 text-center text-xs text-slate-500">
            By continuing you agree to our{" "}
            <Link href="/terms" className="font-medium text-brand-700 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
              Privacy Policy
            </Link>
            , and to the processing of your business data for tender matching and proposal
            generation.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/privacy" className="hover:text-slate-600">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:text-slate-600">Terms</Link> ·{" "}
          <Link href="/security" className="hover:text-slate-600">Data &amp; Security</Link> ·{" "}
          <Link href="/refunds" className="hover:text-slate-600">Refunds</Link>
        </p>
      </div>
    </main>
  );
}
