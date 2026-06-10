import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Direct (non-pooled) connection for migrations.
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
