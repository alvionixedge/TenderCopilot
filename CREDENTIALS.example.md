# Credentials & Accounts — Inventory Template

> ⚠️ **This is a TEMPLATE. Do NOT put real passwords, API keys, or secrets in this file, and do
> NOT commit a filled-in copy.** Copy this into your **password manager** (as a secure note) and
> fill it there. A filled `CREDENTIALS.md` is git-ignored, but the safest place is your password
> manager, never the repo.

## How to store credentials (recommended)

1. **Use a password manager** for every account login — Bitwarden (free, open-source), 1Password,
   or similar. One strong master password + **2FA on the vault itself**.
2. **Enable 2FA on every service account** (Vercel, GitHub, Neon, Razorpay, Google, Anthropic,
   Cloudflare, Upstash, Resend). Store the 2FA recovery codes in the password manager.
3. **Account logins** (email + password / SSO) → password manager.
   **API keys & secrets** → **only** in Vercel → Settings → Environment Variables (see README §3).
   Don't duplicate secrets into notes; record *where* they live instead.
4. **One owner email** for all SaaS signups (e.g. a dedicated `ops@` or the founder's address), so
   password resets and billing all land in one inbox. Note it below.
5. **Rotate** any secret that is ever exposed, and update it in Vercel.

## Account inventory (fill in your password manager)

For each service, record: **login URL**, the **account email**, whether **2FA** is on, **what it's
for**, and **where its secrets live**. (Values below are placeholders — replace privately.)

| Service | Login URL | Account email | 2FA? | Purpose | Secrets stored in |
|---|---|---|---|---|---|
| GitHub | github.com/login | `<email>` | ☐ | Source code, CI | n/a (repo access) |
| Vercel | vercel.com/login | `<email>` | ☐ | Hosting, deploys, **all env-var secrets** | Vercel env store |
| Neon | console.neon.tech | `<email>` | ☐ | Database | `DATABASE_URL`, `DATABASE_POOL_URL` → Vercel |
| Google Cloud | console.cloud.google.com | `<email>` | ☐ | Google OAuth | `AUTH_GOOGLE_ID/SECRET` → Vercel |
| Microsoft Entra | portal.azure.com | `<email>` | ☐ | Microsoft OAuth (optional) | `AUTH_MICROSOFT_*` → Vercel |
| Anthropic | console.anthropic.com | `<email>` | ☐ | Claude API | `ANTHROPIC_API_KEY` → Vercel |
| Cloudflare | dash.cloudflare.com | `<email>` | ☐ | R2 document storage | `R2_*` → Vercel |
| Upstash | upstash.com | `<email>` | ☐ | Redis rate limiting | `UPSTASH_*` → Vercel |
| Resend | resend.com | `<email>` | ☐ | Funnel email | `RESEND_API_KEY` → Vercel |
| Razorpay | dashboard.razorpay.com | `<email>` | ☐ | Payments | `RAZORPAY_*` → Vercel |
| Domain registrar | `<registrar>` | `<email>` | ☐ | `tendercopilot.in` DNS | n/a |

## Also record (in the password manager)

- **Recovery info** for the domain registrar and each critical account.
- **Razorpay:** which mode is live (Test/Live), the settlement bank account reference, and where the
  webhook secret is stored (Vercel `RAZORPAY_WEBHOOK_SECRET`).
- **Generated secrets** you created yourself (`AUTH_SECRET`, `CRON_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
  — keep a copy in the password manager as well as Vercel, in case you need to reference them.
- **Team access:** if others need access, prefer the service's own team/member invites over sharing
  a login; use a shared password-manager vault only where a service has no team feature.
