import { defineConfig } from "drizzle-kit";

const connectionString = process.env.NEON_SECRET || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or NEON_SECRET must be set, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
