import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startSyncScheduler, stopSyncScheduler } from "./lib/sync-scheduler";
import { closeDatabase, db } from "./db";
import { pruneExpiredAttempts } from "./admin-auth";
import { sql } from "drizzle-orm";

const REQUIRED_ENV_VARS = [
  "SESSION_SECRET",
] as const;

const CONDITIONAL_ENV_VARS: Array<{ name: string; condition: () => boolean; message: string }> = [
  {
    name: "ENCRYPTION_SALT",
    condition: () => process.env.NODE_ENV === "production",
    message: "ENCRYPTION_SALT is required in production for PII encryption",
  },
  {
    name: "HOST_URL",
    condition: () => process.env.NODE_ENV === "production",
    message: "HOST_URL must be set in production to avoid localhost fallbacks in OAuth redirects",
  },
  {
    name: "SHOPIFY_API_SECRET",
    condition: () => process.env.NODE_ENV === "production" && !!process.env.ENCRYPTION_SALT,
    message: "SHOPIFY_API_SECRET is required when PII encryption is active (used for key derivation)",
  },
];

function validateEnvironment(): void {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL && !process.env.NEON_SECRET) {
    missing.push("DATABASE_URL or NEON_SECRET (at least one database connection is required)");
  }

  for (const name of REQUIRED_ENV_VARS) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }

  for (const { name, condition, message } of CONDITIONAL_ENV_VARS) {
    if (condition() && !process.env[name]) {
      missing.push(`${name} (${message})`);
    }
  }

  if (missing.length > 0) {
    const list = missing.map((m) => `  - ${m}`).join("\n");
    console.error(`\nFATAL: Missing required environment variables:\n${list}\n`);
    process.exit(1);
  }

  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
    console.warn("[startup] SHOPIFY_API_KEY / SHOPIFY_API_SECRET not set — Shopify integration disabled");
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("[startup] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not set — global Twilio fallback disabled");
  }

  if (process.env.DEV_SKIP_AUTH === "true") {
    if (process.env.NODE_ENV === "development") {
      console.warn("\n⚠️  WARNING: DEV_SKIP_AUTH is enabled — authentication bypasses are active.");
      console.warn("⚠️  Session token and App Proxy signature verification will be skipped.");
      console.warn("⚠️  Do NOT deploy with this setting enabled.\n");
    } else {
      console.error(`\nFATAL: DEV_SKIP_AUTH=true is set but NODE_ENV is "${process.env.NODE_ENV}" (not "development").`);
      console.error("This flag is only allowed in development. Remove DEV_SKIP_AUTH or set NODE_ENV=development.\n");
      process.exit(1);
    }
  }

  console.log("[startup] Environment validation passed");
}

validateEnvironment();

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: Buffer | undefined;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use(compression());


export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

app.get("/health", async (_req: Request, res: Response) => {
  const status: { status: string; database: string; uptime: number; timestamp: string } = {
    status: "ok",
    database: "unknown",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  try {
    await db.execute(sql`SELECT 1`);
    status.database = "connected";
  } catch (error) {
    status.status = "degraded";
    status.database = "disconnected";
    return res.status(503).json(status);
  }

  res.json(status);
});

let isShuttingDown = false;

function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log(`Received ${signal}. Starting graceful shutdown...`, "shutdown");

  stopSyncScheduler();

  httpServer.close(async () => {
    log("HTTP server closed", "shutdown");

    try {
      await closeDatabase();
    } catch (err) {
      console.error("[shutdown] Error closing database:", err);
    }

    log("Shutdown complete", "shutdown");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[shutdown] Forceful shutdown after timeout");
    process.exit(1);
  }, 15_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    log(`Unhandled error (${status}): ${message}`, "error");
    res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      startSyncScheduler();
      pruneExpiredAttempts().catch((err) =>
        console.error("[startup] Failed to prune expired login attempts:", err),
      );
    },
  );
})();
