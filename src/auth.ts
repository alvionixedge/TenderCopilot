import NextAuth, { type DefaultSession } from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { isDbConfigured } from "@/db";
import { provisionUser } from "@/lib/provision";

declare module "next-auth" {
  interface Session {
    userId: string;
    orgId: string;
    role: string;
    plan: string;
    user: DefaultSession["user"];
  }
}

const providers: Provider[] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

if (process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    }),
  );
}

export const configuredProviders = providers.map((p) =>
  typeof p === "function" ? p().id : p.id,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  trustHost: true,
  callbacks: {
    async jwt({ token, user, account }) {
      // First sign-in: provision user + organization + membership (spec 4.1).
      if (account && user?.email && isDbConfigured()) {
        try {
          const identity = await provisionUser({
            name: user.name ?? user.email,
            email: user.email,
            image: user.image,
          });
          token.userId = identity.userId;
          token.orgId = identity.orgId;
          token.role = identity.role;
          token.plan = identity.plan;
        } catch (err) {
          console.error("[auth] provisioning failed", err);
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = (token.userId as string) ?? "";
      session.orgId = (token.orgId as string) ?? "";
      session.role = (token.role as string) ?? "member";
      session.plan = (token.plan as string) ?? "free";
      return session;
    },
  },
});
