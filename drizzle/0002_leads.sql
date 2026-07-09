-- Idempotent for safety (see 0001) — this table is new, but guard anyway so a
-- re-run against a partially-migrated database never fails the deploy.
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"capabilities" text,
	"tender_text" text,
	"match_score" smallint,
	"eligibility_score" smallint,
	"win_probability" smallint,
	"verdict" varchar(20),
	"source" varchar(30) DEFAULT 'free_check' NOT NULL,
	"welcomed_at" timestamp with time zone,
	"matched_email_at" timestamp with time zone,
	"converted_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_user_id_users_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leads_email_uq" ON "leads" USING btree ("email");
