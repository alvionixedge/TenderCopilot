<p align="center">
  <img src="public/brand/logo.png" alt="TenderCopilot AI" width="420" />
</p>

# TenderCopilot AI

AI-powered procurement & bid management platform for Indian SMBs, MSMEs and bid
consultants. Implements the **Technical Specification v6.2** (cloud-only deployment,
budget PaaS architecture, multi-tenant SaaS).

The platform ingests public-sector tenders (GeM, CPPP, state portals, PSUs), scores
each opportunity against the customer's company profile, generates compliant proposal
documents (DOCX), and tracks the full bid lifecycle through an integrated Kanban CRM.

## Tech stack (spec §2.2)

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Database | Neon serverless PostgreSQL + pgvector |
| ORM | Drizzle ORM + postgres.js (SQL-first migrations) |
| Auth | NextAuth.js v5 (Auth.js) — Google & Microsoft Entra ID OAuth |
| Object storage | Cloudflare R2 (private, pre-signed URLs ≤300 s) |
| AI | Claude API (`claude-haiku-4-5`) with deterministic fallback |
| Async / rate limiting | Vercel Cron + Upstash Redis |
| Hosting | Vercel (cloud-only — no local deployment target, spec §2.4) |

## Project structure

```
src/
├── auth.ts                 # NextAuth v5 config + tenant provisioning on first sign-in
├── db/schema.ts            # Spec §3 data model (23 tables, RLS-ready org scoping)
├── lib/                    # scoring, entitlements, AI traceability, R2, rate limits, audit
├── app/
│   ├── page.tsx            # Marketing landing page
│   ├── signin/             # OAuth sign-in
│   ├── (app)/              # Authenticated app: dashboard, tenders, proposals, pipeline…
│   └── api/
│       ├── v1/             # Spec §4 API surface (standard error envelope)
│       ├── cron/ingest     # Scheduled tender ingestion (idempotent upsert)
│       └── health          # Post-deploy verification (spec §7.2 stage 5)
drizzle/                    # Versioned SQL migrations (auto-applied at deploy, spec §7.5)
scripts/migrate.mjs         # Build-step migration runner (fail-safe)
scripts/seed.mjs            # Idempotent plan_features seed
.github/workflows/ci.yml    # CI gate: typecheck + lint + test (spec §7.4)
```

## Deployment

**This application is cloud-only (spec §2.4).** Every environment — preview and
production — runs on Vercel with Neon, R2 and Upstash as managed backing services.
There is no local deployment target.

The single deployment path is: **git push → GitHub Actions CI gate → Vercel build
(`node scripts/migrate.mjs && next build`) → atomic promote**. A migration failure
fails the build and the previous release stays live.

➡️ **See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete step-by-step pre/post
deployment runbook.**

## Development scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local authoring convenience (connect to a Neon dev branch — never serves users) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit tests |
| `npm run db:generate` | Author a new Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations (runs automatically in the Vercel build) |
| `npm run db:seed` | Seed plan entitlements (idempotent) |

## Spec traceability (MVP scope)

Implemented in this milestone: tenant provisioning & SSO (§4.1, §5.1), company
profiles & document pre-sign flow (§4.2, §8.2 quarantine bucket), tender feed +
match/eligibility/win scoring with AI reasoning & traceability (§4.3, §3.16),
proposal generation with revisioned DOCX output (§4.4, §3.10–3.11), CRM pipeline
with optimistic concurrency + win/loss capture (§4.5, §6.4, §3.13), entitlements &
usage metering (§3.18–3.19), audit log (§3.15), jobs table (§3.14), idempotent cron
ingestion (§6.1), health endpoint & CI/CD pipeline (§7).

Staged for next milestones (per the spec's own phased plan, §10.4): Postgres RLS
policies (§8.1), QStash background workers (§9.2), Razorpay billing (§11), malware
scanning worker (§8.2), pgvector semantic matching at scale (§10.1), SAML/SCIM &
MFA (§13), real portal crawlers replacing the curated ingestion source.
