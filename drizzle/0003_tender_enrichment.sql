-- Idempotent (see 0001/0002): preview deploys share the prod DB, so guard
-- against a double-apply. Detail-page enrichment columns on tenders.
ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "msme_reserved" boolean;--> statement-breakpoint
ALTER TABLE "tenders" ADD COLUMN IF NOT EXISTS "min_employees" integer;
