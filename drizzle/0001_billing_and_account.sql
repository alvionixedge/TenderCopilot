-- Idempotent: preview deployments of the earlier feature branches may have
-- already applied parts of this schema to the shared database, so every
-- object is created conditionally and the FK is guarded.
CREATE TABLE IF NOT EXISTS "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"razorpay_event_id" varchar(80) NOT NULL,
	"type" varchar(30) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(20) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deactivated_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_event_uq" ON "payment_events" USING btree ("razorpay_event_id");
