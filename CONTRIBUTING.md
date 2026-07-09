# Contributing to TenderCopilot AI

Thanks for working on TenderCopilot AI. This is the short version of how changes flow from your
machine to production. For architecture, services, env vars, and "how to change X" recipes, see
**[README.md](README.md)**.

## Prerequisites

- Node.js **20+**
- Access to the repo and (for deploys) the Vercel project
- A Neon **dev branch** connection string for local work — never point local dev at production data

```bash
npm install
cp .env.example .env.local   # fill with dev values
npm run dev                  # http://localhost:3000
```

## The workflow: branch → PR → CI → merge

```
main (production)  ──▶ every merge auto-deploys to https://www.tendercopilot.in
   ▲
   │  merge (squash) after review + green CI
   │
your-branch  ──push──▶  PR to main  ──▶  GitHub Actions CI gate
```

1. **Branch off `main`.** Never commit directly to `main`.
   Naming: `feat/…`, `fix/…`, `docs/…`, `chore/…` (e.g. `feat/invite-members`).
2. **Make your change.** Keep it focused; one logical change per PR.
3. **Run the checks locally before pushing:**
   ```bash
   npm run typecheck && npm run lint && npm run test && npm run build
   ```
   All four must pass. `npm run build` also runs migrations, so it catches migration issues.
4. **Push and open a PR** against `main`. GitHub Actions runs the CI gate (typecheck + lint +
   test); Vercel builds a preview.
5. **Review** against the preview URL. Address feedback.
6. **Merge** (squash recommended) once CI is green. This triggers the production deploy
   (migrations auto-apply, then the app promotes). **Delete the branch.**

## Commit messages

- Imperative mood: "Add invite flow", not "Added invite flow".
- Explain the *why* in the body when it isn't obvious.

## Database migrations

Migrations apply **automatically** during the Vercel build, so authoring discipline matters:

1. Edit `src/db/schema.ts`.
2. `npm run db:generate` → creates `drizzle/000N_*.sql`. **Commit the schema and the migration
   together.**
3. Make migrations **additive** (nullable columns / new tables) so the currently-running version
   isn't broken during the deploy overlap (expand-then-contract).
4. Prefer **idempotent** SQL (`IF NOT EXISTS`, guarded constraints) — see existing migrations —
   so a re-run against a partially-migrated database can't fail the build.
5. Never hand-edit an already-deployed migration; add a new one.

## Never commit secrets

- No API keys, passwords, connection strings, or `.env*` files in the repo.
- All secrets live in **Vercel → Settings → Environment Variables** only.
- `.env.example` documents variable **names** with empty values — keep it in sync when you add a
  variable.
- If a secret is ever committed or exposed, **rotate it immediately** and force-update it in Vercel.

## Changing environment variables

Add/edit in Vercel (Production + Preview) → **Redeploy** (env changes only apply on a new deploy).
Document the new variable in `.env.example` and README §2/§3.

## Rollback

Vercel → Deployments → pick a known-good build → **Promote to Production** (instant). Because
migrations are expand-then-contract, rolling back code does not require rolling back the schema.

## Versioning & changelog

Note user-facing changes in **[CHANGELOG.md](CHANGELOG.md)** under `[Unreleased]` as part of your PR.
