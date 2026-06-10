# TenderCopilot AI — Deployment Runbook (Cloud-Only)

This is the complete, ordered runbook for taking the repository live on Vercel with
Neon, Cloudflare R2 and Upstash — per spec §2.4 (cloud-only mandate) and §7
(deployment & CI/CD). Everything here is done **once**; afterwards every `git push`
deploys automatically.

> **Time required:** ~45–60 minutes for all services.
> **Cost:** ₹0/month at MVP scale — every service below has a free tier.

---

## Phase 0 — Accounts you need (one-time)

| Service | Sign up at | Used for | Free tier |
|---|---|---|---|
| Vercel | vercel.com | Hosting, build, cron, env-var store | Hobby |
| Neon | neon.tech | Serverless PostgreSQL + pgvector | 0.5 GB |
| Google Cloud | console.cloud.google.com | Google OAuth sign-in | Free |
| Microsoft Entra | portal.azure.com | Microsoft OAuth sign-in (optional) | Free |
| Anthropic | console.anthropic.com | Claude API (scoring & proposals) | Pay-per-use |
| Cloudflare | dash.cloudflare.com | R2 document storage (optional at first) | 10 GB |
| Upstash | upstash.com | Redis rate limiting (optional at first) | 10K cmd/day |

**Minimum to go live:** Vercel + Neon + Google OAuth + AUTH_SECRET. Everything else
can be added later — the app degrades gracefully (uploads disabled, heuristic scoring
instead of AI, no rate limiting) and tells you what is missing.

---

## Phase 1 — Pre-deployment

### 1.1 Verify the repository

The codebase lives at `https://github.com/alvionixedge/TenderCopilot`. Confirm the
latest commit is on `main` and that GitHub Actions CI is green
(repo → **Actions** tab → latest "CI" run → all steps passing).

### 1.2 Create the Neon database

1. Log in to **neon.tech** → **New Project**.
2. Name: `tendercopilot` · Postgres version: 16+ · Region: **AWS ap-southeast-1
   (Singapore)** (closest to Indian users).
3. After creation, open **Dashboard → Connection Details**:
   - Select branch `main` (the **primary** branch → production data).
   - Copy the **pooled** connection string (host contains `-pooler`) → this is
     `DATABASE_POOL_URL`.
   - Toggle to the **direct** (non-pooled) string → this is `DATABASE_URL`
     (migrations need the direct connection).
4. Both strings must end with `?sslmode=require`.

> pgvector: nothing to do — the first migration runs
> `CREATE EXTENSION IF NOT EXISTS vector;` and Neon supports it natively.

### 1.3 Create Google OAuth credentials

1. **console.cloud.google.com** → create project `TenderCopilot` (or reuse one).
2. **APIs & Services → OAuth consent screen**:
   - User type **External** → fill App name `TenderCopilot AI`, support email,
     developer email. Scopes: leave default (email/profile/openid). Save.
   - While in "Testing" mode only your listed test users can sign in. For public
     access, click **Publish app** (basic scopes do not require verification review
     to function, users just see an unverified warning until verified).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**, name `TenderCopilot Vercel`.
   - Authorized JavaScript origins: `https://<your-project>.vercel.app`
     (you'll know the exact URL after Phase 2; you can come back and add it,
     or set it now if you'll choose the project name `tendercopilot` →
     `https://tendercopilot.vercel.app`). Add your custom domain too if you have one.
   - Authorized redirect URIs:
     `https://<your-project>.vercel.app/api/auth/callback/google`
     (and `https://yourdomain.com/api/auth/callback/google` for a custom domain).
4. Copy the **Client ID** → `AUTH_GOOGLE_ID` and **Client secret** → `AUTH_GOOGLE_SECRET`.

### 1.4 (Optional) Microsoft Entra ID OAuth

1. **portal.azure.com** → Microsoft Entra ID → **App registrations → New registration**.
2. Name `TenderCopilot AI`; supported account types: **Accounts in any organizational
   directory and personal Microsoft accounts**.
3. Redirect URI (Web): `https://<your-project>.vercel.app/api/auth/callback/microsoft-entra-id`.
4. After creation: **Certificates & secrets → New client secret** → copy the secret
   **Value** immediately → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
5. Overview page → **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`.
6. `AUTH_MICROSOFT_ENTRA_ID_ISSUER` = `https://login.microsoftonline.com/common/v2.0`.

### 1.5 Generate the auth & cron secrets

On any machine with OpenSSL (or use an online generator you trust):

```bash
openssl rand -base64 32   # → AUTH_SECRET
openssl rand -base64 32   # → CRON_SECRET (run again for a different value)
```

### 1.6 Get the Anthropic API key

1. **console.anthropic.com** → **API keys → Create key** → copy → `ANTHROPIC_API_KEY`.
2. Add a small amount of credit (₹500–1000 equivalent) under Billing.
3. `ANTHROPIC_MODEL` = `claude-haiku-4-5` (already the default).

> Skippable at first: without the key, scoring falls back to the built-in heuristic
> engine and proposals use the structured compliance template.

### 1.7 (Optional) Cloudflare R2 for document uploads

1. **dash.cloudflare.com** → **R2 Object Storage** → create buckets
   `tendercopilot-documents` and `tendercopilot-quarantine` (region: APAC). Keep both
   **private** (no public access).
2. R2 → **Manage R2 API Tokens → Create API token**: permissions **Object Read &
   Write**, scoped to those two buckets.
3. Copy: Access Key ID → `R2_ACCESS_KEY_ID`, Secret Access Key → `R2_SECRET_ACCESS_KEY`,
   and your Account ID (R2 overview page) → `R2_ACCOUNT_ID`.
4. Bucket → **Settings → CORS policy** on `tendercopilot-quarantine`, allow your app
   origin to PUT:

```json
[
  {
    "AllowedOrigins": ["https://<your-project>.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

### 1.8 (Optional) Upstash Redis for AI rate limiting

1. **upstash.com** → **Redis → Create database** (region: ap-southeast-1).
2. Copy from the REST API section: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

---

## Phase 2 — Deploy to Vercel

### 2.1 Import the repository

1. **vercel.com** → log in (use **Continue with GitHub** as `alvionixedge` so the repo
   is visible) → **Add New → Project**.
2. Import `alvionixedge/TenderCopilot`. If it's not listed, click **Adjust GitHub App
   Permissions** and grant Vercel access to the repository.
3. Framework preset: **Next.js** (auto-detected). Build command and output: leave
   defaults (`npm run build` already includes the migration step). Root directory: `/`.

### 2.2 Set environment variables (before first deploy)

In the import screen (or later under **Project → Settings → Environment Variables**),
add — applying each to **Production** and **Preview** unless noted:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Neon **direct** connection string | ✅ |
| `DATABASE_POOL_URL` | Neon **pooled** connection string | ✅ |
| `AUTH_SECRET` | from step 1.5 | ✅ |
| `AUTH_TRUST_HOST` | `true` | ✅ |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from step 1.3 | ✅ (for sign-in) |
| `CRON_SECRET` | from step 1.5 | ✅ (for ingestion) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` | ✅ |
| `ANTHROPIC_API_KEY` | from step 1.6 | recommended |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | recommended |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` | from step 1.4 | optional |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | from step 1.7 | optional |
| `R2_BUCKET_DOCUMENTS` | `tendercopilot-documents` | optional |
| `R2_BUCKET_QUARANTINE` | `tendercopilot-quarantine` | optional |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | from step 1.8 | optional |

> ⚠️ **Never** commit these to Git. The repo's `.env.example` documents the full list.

### 2.3 First deploy

1. Click **Deploy**. Vercel runs `node scripts/migrate.mjs && next build`:
   the migration step creates all 23 tables + pgvector on the Neon primary branch,
   then the app builds. Watch the build log — you should see
   `[migrate] migrations applied.`
2. When the deployment is **Ready**, note your production URL,
   e.g. `https://tendercopilot.vercel.app`.

### 2.4 Wire the production URL back into OAuth

1. Google Cloud → Credentials → your OAuth client → confirm the JavaScript origin and
   redirect URI exactly match the real production URL (and re-save).
2. Same for Microsoft Entra if configured.

---

## Phase 3 — Post-deployment

### 3.1 Verify health

Open `https://<your-app>/api/health` in a browser. Expected:

```json
{ "status": "ok", "database": "ok", "version": "abc1234", ... }
```

If `database` is `unconfigured` or `error`, re-check `DATABASE_URL` /
`DATABASE_POOL_URL` in Vercel → Settings → Environment Variables, then
**Deployments → ⋯ → Redeploy**.

### 3.2 Seed plan entitlements (one command, run once)

From any machine with Node 20+ and the repo cloned:

```bash
npm ci
DATABASE_URL="<your Neon DIRECT connection string>" npm run db:seed
```

Expected output: `[seed] plan_features upserted (12 rows).` (Safe to re-run.)

### 3.3 Populate the tender feed (first ingestion)

The cron job runs daily at 03:00 UTC automatically (see `vercel.json`). Trigger the
first run manually so the feed isn't empty:

```bash
curl -X POST "https://<your-app>/api/cron/ingest" \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

Expected: `{"ok":true,"inserted":10,"updated":0}`.

> On the Vercel **Hobby** plan, cron granularity is daily. On **Pro**, edit
> `vercel.json` to `"schedule": "0 */6 * * *"` to match the spec's 6-hour cadence.

### 3.4 Smoke-test the canonical user journey (spec §1.4)

1. Open the production URL → landing page renders with the TenderCopilot logo.
2. **Get started → Continue with Google** → sign in. You land on the dashboard; your
   organization was provisioned automatically.
3. **Company** → fill the profile (use a real-ish GSTIN format, turnover, capability
   statement) → Save.
4. **Tenders** → the feed shows the ingested tenders → open one → **Analyze fit** →
   match/eligibility/win scores and reasoning appear.
5. **Generate proposal** → wait up to a minute → **Proposals** → **Download DOCX** →
   open the file in Word and confirm the compliance structure.
6. **Add to pipeline** → **Pipeline** → move the card across stages → set **WON** →
   the outcome is recorded (visible on the dashboard "Bids won" stat).
7. `https://<your-app>/api/health` once more — still `ok`.

### 3.5 Turn on deploy protection rules (recommended)

GitHub repo → **Settings → Branches → Add branch ruleset** for `main`:
- Require a pull request before merging.
- Require status checks to pass → select **verify** (the CI job).

This enforces the spec §7.3 flow: PR → CI gate → preview → merge → production.

### 3.6 (Optional) Custom domain

1. Vercel → Project → **Settings → Domains** → add `tendercopilot.ai` (or yours).
2. At your DNS provider, add the CNAME/A records Vercel shows; wait for the ✅.
3. Update `NEXT_PUBLIC_APP_URL`, the Google/Microsoft OAuth redirect URIs, and the R2
   CORS policy to the new domain. Redeploy.

### 3.7 (Optional) Neon preview branches for PRs

Vercel → Project → **Settings → Integrations** (or neon.tech → Integrations) →
install the **Neon ↔ Vercel integration**. Every PR preview then gets an ephemeral
copy-on-write database branch, and migrations rehearse there before ever touching
production (spec §7.5). Branches are deleted automatically when the PR closes.

### 3.8 (Optional) Monitoring

- **Sentry:** sentry.io → create a Next.js project → set `NEXT_PUBLIC_SENTRY_DSN`
  env var (wiring ships in a later milestone; the variable is reserved).
- **Vercel Analytics / Logs:** Project → Observability — no setup needed; check
  function logs under **Logs** if anything misbehaves.

---

## Ongoing operations

| Task | How |
|---|---|
| Ship a change | Branch → PR → CI green → review preview URL → merge to `main` → auto-deploy |
| Schema change | Edit `src/db/schema.ts` → `npm run db:generate` → commit the new `drizzle/*.sql` → PR (expand-then-contract: additive first, destructive later — spec §7.6) |
| Roll back | Vercel → Deployments → previous build → **Promote to Production** (instant; schema stays compatible because migrations are expand-then-contract) |
| Rotate a secret | Vercel → Settings → Environment Variables → edit → Redeploy. No code change |
| Database restore | Neon → Branches → **Restore** (point-in-time) — spec §7.7 |
| Watch ingestion | Vercel → Logs, filter `/api/cron/ingest`; jobs table records every run |

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Build fails at `[migrate]` | Bad `DATABASE_URL` (must be the **direct**, non-pooled Neon string). Previous release stays live — fix the var and redeploy |
| "Sign-in is not configured yet" on /signin | `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`/`AUTH_SECRET` missing in the environment → add and redeploy |
| `redirect_uri_mismatch` from Google | The redirect URI in Google Cloud doesn't exactly match `https://<host>/api/auth/callback/google` |
| Empty tender feed | First ingestion not run → step 3.3 |
| 402 "plan allows N proposals" | Free-plan entitlement cap working as designed; seed ran (3.2) and limits apply |
| 503 on document upload | R2 env vars not set (optional feature) → step 1.7 |
| AI reasoning missing / template proposals | `ANTHROPIC_API_KEY` not set or out of credit — heuristic fallback is by design |
