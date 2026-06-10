/**
 * TenderCopilot AI — database schema (Drizzle ORM, PostgreSQL/Neon).
 *
 * Implements the core data model from the Technical Specification v6.2,
 * Section 3. UUIDs as primary keys throughout; all timestamps timestamptz
 * (UTC). pgvector stores embeddings (the `vector` extension is created in
 * the initial migration).
 *
 * Tenancy: the organization is the tenant root. Every tenant-scoped table
 * carries org_id; queries are scoped server-side from the session
 * (Section 8.1 RLS hardening is staged as a follow-up migration).
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  smallint,
  numeric,
  boolean,
  timestamp,
  jsonb,
  date,
  bigserial,
  vector,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// 3.1 organizations (tenant root)
// ---------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default("company"), // company | consultancy
  plan: varchar("plan", { length: 20 }).notNull().default("free"), // free | pro | business
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.2 users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.3 memberships (user <-> organization, with role)
// ---------------------------------------------------------------------------
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: varchar("role", { length: 20 }).notNull().default("member"), // owner | admin | member
    status: varchar("status", { length: 20 }).notNull().default("active"), // invited | active | suspended | removed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_org_user_uq").on(t.orgId, t.userId)],
);

// ---------------------------------------------------------------------------
// 3.3a membership_company_access (company-level scoping)
// ---------------------------------------------------------------------------
export const membershipCompanyAccess = pgTable(
  "membership_company_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mca_membership_company_uq").on(t.membershipId, t.companyId)],
);

// ---------------------------------------------------------------------------
// 3.4 companies
// ---------------------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  gstNumber: varchar("gst_number", { length: 15 }).unique(),
  panNumber: varchar("pan_number", { length: 10 }),
  msmeNumber: varchar("msme_number", { length: 30 }),
  website: text("website"),
  description: text("description"),
  employeeCount: integer("employee_count"),
  annualTurnover: numeric("annual_turnover", { precision: 15, scale: 2 }),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.5 company_documents
// ---------------------------------------------------------------------------
export const companyDocuments = pgTable("company_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  documentType: varchar("document_type", { length: 30 }).notNull(), // GST | PAN | MSME | ISO | AuditedFinancials | CaseStudy | ReferenceLetter
  fileUrl: text("file_url").notNull(), // R2 object key (private)
  scanStatus: varchar("scan_status", { length: 20 }).notNull().default("pending"), // pending | clean | infected | rejected
  verificationStatus: varchar("verification_status", { length: 20 })
    .notNull()
    .default("unverified"), // unverified | verified | expired | invalid
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.6 tenders (global, not tenant-scoped)
// ---------------------------------------------------------------------------
export const tenders = pgTable("tenders", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 40 }).notNull(), // GeM | CPPP | StatePortal | PSU
  sourceUrl: text("source_url").notNull().unique(), // exact-dedupe key
  contentHash: varchar("content_hash", { length: 64 }),
  canonicalGroupId: uuid("canonical_group_id"),
  title: text("title").notNull(),
  department: varchar("department", { length: 255 }),
  estimatedValue: numeric("estimated_value", { precision: 15, scale: 2 }),
  emd: numeric("emd", { precision: 15, scale: 2 }),
  submissionDate: timestamp("submission_date", { withTimezone: true }),
  currentVersion: integer("current_version").notNull().default(1),
  status: varchar("status", { length: 20 }).notNull().default("open"), // open | amended | extended | closed | cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.7 tender_versions (amendments & corrigenda)
// ---------------------------------------------------------------------------
export const tenderVersions = pgTable(
  "tender_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id),
    version: integer("version").notNull(),
    changeType: varchar("change_type", { length: 20 }).notNull(), // original | corrigendum | amendment | clarification | deadline_extension
    impactClass: varchar("impact_class", { length: 20 }).notNull().default("unknown"), // deadline_only | financial | eligibility | scope | cosmetic
    pdfUrl: text("pdf_url"),
    summary: text("summary"),
    embedding: vector("embedding", { dimensions: 1536 }),
    submissionDate: timestamp("submission_date", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tender_versions_tender_version_uq").on(t.tenderId, t.version)],
);

// ---------------------------------------------------------------------------
// 3.8 tender_requirements
// ---------------------------------------------------------------------------
export const tenderRequirements = pgTable("tender_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id),
  tenderVersion: integer("tender_version").notNull(),
  requirement: text("requirement").notNull(),
  mandatory: boolean("mandatory").notNull().default(true),
  category: varchar("category", { length: 40 }), // Technical | Financial | Legal | Compliance
});

// ---------------------------------------------------------------------------
// 3.9 tender_matches
// ---------------------------------------------------------------------------
export const tenderMatches = pgTable(
  "tender_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id),
    tenderVersion: integer("tender_version").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    matchScore: smallint("match_score").notNull(),
    eligibilityScore: smallint("eligibility_score").notNull(),
    winProbability: smallint("win_probability"),
    reasoning: text("reasoning"),
    isStale: boolean("is_stale").notNull().default(false),
    aiTraceId: uuid("ai_trace_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tender_matches_tender_version_company_uq").on(
      t.tenderId,
      t.tenderVersion,
      t.companyId,
    ),
    index("tender_matches_org_idx").on(t.orgId),
  ],
);

// ---------------------------------------------------------------------------
// 3.10 proposals
// ---------------------------------------------------------------------------
export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id),
  status: varchar("status", { length: 20 }).notNull().default("draft"), // draft | generating | ready | submitted | failed
  currentVersion: integer("current_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.11 proposal_versions (revision history)
// content_md is an MVP-pragmatic addition: the generated proposal body is
// stored inline so DOCX can be rendered on demand; file_url remains the R2
// pointer once object storage is wired.
// ---------------------------------------------------------------------------
export const proposalVersions = pgTable(
  "proposal_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id),
    version: integer("version").notNull(),
    label: varchar("label", { length: 20 }).notNull().default("draft"), // draft | final | submitted
    fileUrl: text("file_url"),
    contentMd: text("content_md"),
    completeness: smallint("completeness"),
    aiTraceId: uuid("ai_trace_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("proposal_versions_proposal_version_uq").on(t.proposalId, t.version)],
);

// ---------------------------------------------------------------------------
// 3.12 opportunities (CRM pipeline)
// ---------------------------------------------------------------------------
export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id),
  stage: varchar("stage", { length: 20 }).notNull().default("DISCOVERED"), // DISCOVERED | QUALIFIED | PROPOSAL | REVIEW | SUBMITTED | WON | LOST
  assignedTo: uuid("assigned_to").references(() => users.id),
  dueDate: timestamp("due_date", { withTimezone: true }),
  version: integer("version").notNull().default(1), // optimistic-concurrency token
});

// ---------------------------------------------------------------------------
// 3.13 bid_outcomes (win/loss intelligence)
// ---------------------------------------------------------------------------
export const bidOutcomes = pgTable(
  "bid_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id),
    result: varchar("result", { length: 10 }).notNull(), // WON | LOST
    ourBidAmount: numeric("our_bid_amount", { precision: 15, scale: 2 }),
    winnerName: varchar("winner_name", { length: 255 }),
    winningBidAmount: numeric("winning_bid_amount", { precision: 15, scale: 2 }),
    competitorCount: integer("competitor_count"),
    lossReason: varchar("loss_reason", { length: 40 }), // price | eligibility | technical | documentation | late | other
    contractValue: numeric("contract_value", { precision: 15, scale: 2 }),
    notes: text("notes"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("bid_outcomes_opportunity_uq").on(t.opportunityId)],
);

// ---------------------------------------------------------------------------
// 3.14 jobs (background orchestration)
// ---------------------------------------------------------------------------
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id),
  type: varchar("type", { length: 40 }).notNull(), // ingest | extract_text | ocr | embed | extract_requirements | score | generate_proposal | notify
  status: varchar("status", { length: 20 }).notNull().default("queued"), // queued | running | succeeded | failed | dead_letter
  payload: jsonb("payload").notNull(),
  parentJobId: uuid("parent_job_id"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastError: text("last_error"),
  runAfter: timestamp("run_after", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.15 audit_log (append-only)
// ---------------------------------------------------------------------------
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 60 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.16 ai_generations (traceability / explainability)
// ---------------------------------------------------------------------------
export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  purpose: varchar("purpose", { length: 30 }).notNull(), // score | proposal | summary | requirements | review
  model: varchar("model", { length: 60 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 20 }).notNull(),
  systemPromptHash: varchar("system_prompt_hash", { length: 64 }),
  renderedPromptRef: text("rendered_prompt_ref"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }),
  modelParams: jsonb("model_params"),
  providerResponseId: varchar("provider_response_id", { length: 80 }),
  outputSchemaVersion: varchar("output_schema_version", { length: 20 }),
  retrievedChunks: jsonb("retrieved_chunks"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  confidence: smallint("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.17 subscriptions (billing lifecycle)
// ---------------------------------------------------------------------------
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    plan: varchar("plan", { length: 20 }).notNull(), // free | pro | business
    status: varchar("status", { length: 20 }).notNull().default("trial"), // trial | active | past_due | cancelled | expired | suspended
    razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 60 }),
    razorpayCustomerId: varchar("razorpay_customer_id", { length: 60 }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscriptions_org_uq").on(t.orgId)],
);

// ---------------------------------------------------------------------------
// 3.18 plan_features (entitlements definition)
// ---------------------------------------------------------------------------
export const planFeatures = pgTable(
  "plan_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plan: varchar("plan", { length: 20 }).notNull(),
    featureKey: varchar("feature_key", { length: 40 }).notNull(), // proposals_per_month | tenders_per_day | ai_tokens_per_month | seats | companies
    limitValue: integer("limit_value"), // NULL = unlimited
    period: varchar("period", { length: 10 }).notNull().default("month"), // day | month | total
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("plan_features_plan_feature_uq").on(t.plan, t.featureKey)],
);

// ---------------------------------------------------------------------------
// 3.19 usage_counters (metering & enforcement)
// ---------------------------------------------------------------------------
export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    featureKey: varchar("feature_key", { length: 40 }).notNull(),
    periodStart: date("period_start").notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_counters_org_feature_period_uq").on(t.orgId, t.featureKey, t.periodStart),
  ],
);

// ---------------------------------------------------------------------------
// 3.20 invitations (member onboarding)
// ---------------------------------------------------------------------------
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | accepted | revoked | expired
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3.21 sessions (revocable)
// ---------------------------------------------------------------------------
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  deviceLabel: varchar("device_label", { length: 120 }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// 3.29 notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  type: varchar("type", { length: 40 }).notNull(), // proposal_ready | tender_amended | deadline_approaching | ...
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
