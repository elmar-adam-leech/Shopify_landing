import * as schema from "@shared/schema";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import pg from "pg";

const { Pool } = pg;

const isDevelopment = process.env.NODE_ENV === "development";
const useNeon = !isDevelopment && !!process.env.NEON_SECRET;

let db: ReturnType<typeof drizzleNeonHttp> | ReturnType<typeof drizzleNodePg>;
let pool: InstanceType<typeof Pool> | undefined;

if (useNeon) {
  db = drizzleNeonHttp(process.env.NEON_SECRET!, { schema });
  console.log("[db] Using Neon serverless driver (neon-http)");
} else if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNodePg(pool, { schema });
  console.log("[db] Using node-postgres driver (pg Pool)");
} else {
  throw new Error(
    "DATABASE_URL or NEON_SECRET must be set. Did you forget to provision a database?",
  );
}

async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log("[db] Database pool closed");
  }
}

export { db, pool, closeDatabase };
