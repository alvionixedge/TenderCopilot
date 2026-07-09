# Changelog

All notable changes to TenderCopilot AI are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project uses date-based release entries.

## [Unreleased]

_Add user-facing changes here as part of your PR._

## [0.2.0] — 2026-07-09

Major feature release: monetisation, first-party auth, legal/compliance, and a lead-gen funnel.
Shipped as one consolidated release (PR #5) plus documentation.

### Added
- **Razorpay billing** — one-time monthly payments **and** recurring subscriptions. Signature-
  verified, idempotent webhook (`/api/webhooks/razorpay`) drives the plan lifecycle. New
  `payment_events` table. Billing page with Subscribe / Pay-once and payment history.
- **Self-serve subscription cancellation** — cancels at cycle end (no refund); Billing page shows
  a Cancel button and a "cancels at period end" badge.
- **Email/password sign-in** alongside Google/Microsoft OAuth (NextAuth Credentials provider).
- **Legal pages** — `/privacy`, `/security` (Data & Security, incl. password-storage disclosure),
  `/terms`, and `/refunds` (Refund & Cancellation Policy).
- **Account lifecycle** — self-serve **deactivation** (reversible) and **deletion** (RTBF, cascades
  all solely-owned org data + the user in one transaction), in Settings → Danger zone.
- **Free-check funnel** — public `/free-check` tender-eligibility checker (ad landing page) backed
  by `/api/v1/free-check`, with a signup CTA that pre-fills the email.
- **Lead capture + trigger emails** — `leads` table; on first capture the funnel sends a welcome
  email and a "matching tenders" email via Resend (`/api/v1/leads`).
- **Comprehensive documentation** — master README (services, env vars, architecture, codebase map,
  feature→code map, change recipes, operations runbook), and Razorpay setup + KYC in DEPLOYMENT.md.

### Changed
- Entitlement enforcement now reads the **live org plan** from the database, so a billing upgrade
  applies immediately without waiting for the session JWT to refresh.
- Migrations made **idempotent** (`IF NOT EXISTS` / guarded constraints) so deploys are safe against
  a partially-migrated database.

### Fixed
- Proposal generation **falls back to the deterministic template** when the AI provider errors
  (invalid key, no credit, timeout) instead of hard-failing with a 502 (spec §6.2).
- Resolved a migration-numbering collision between the billing and auth work by consolidating into a
  single linear chain (`0000_init` → `0001_billing_and_account` → `0002_leads`).

### Security
- First-party passwords hashed with **scrypt + a per-user random salt**, constant-time verification;
  raw passwords never stored or logged.
- **Per-IP rate limiting** added to the public free-check (30/min) and lead-capture (6/min)
  endpoints to prevent abuse of the email-sending path.

## [0.1.0] — 2026-06-10

Initial MVP built against Technical Specification v6.2.

### Added
- Multi-tenant SaaS foundation on Next.js 15 (App Router) + Drizzle ORM + Neon PostgreSQL.
- Auth via NextAuth (Google + Microsoft), automatic organization/membership provisioning on first
  sign-in.
- Company profiles + document pre-sign upload flow (Cloudflare R2 quarantine bucket).
- Tender feed with match / eligibility / win-probability scoring and AI reasoning, with full AI
  traceability (`ai_generations`).
- Proposal generation with revisioned DOCX output.
- CRM Kanban pipeline with optimistic concurrency and win/loss outcome capture.
- Plan entitlements & usage metering, append-only audit log, jobs orchestration table.
- Idempotent scheduled tender ingestion (Vercel Cron), health endpoint, and the GitHub Actions
  CI gate.
- Marketing landing page and the authenticated app shell (dashboard, tenders, proposals, pipeline,
  company, settings).
