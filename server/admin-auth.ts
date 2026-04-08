import { Router, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    adminUserId?: string;
    adminRole?: string;
    csrfToken?: string;
  }
}

const PgStore = connectPgSimple(session);

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;

const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const pruneTimer = setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((value, key) => {
    if (now - value.lastAttempt > LOCKOUT_DURATION) {
      loginAttempts.delete(key);
    }
  });
}, PRUNE_INTERVAL_MS);
pruneTimer.unref();

export function stopPruneTimer(): void {
  clearInterval(pruneTimer);
  console.log("[Admin] Login attempt prune timer stopped");
}

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  
  if (!attempts) return { allowed: true };
  
  if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  
  if (attempts.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((LOCKOUT_DURATION - (now - attempts.lastAttempt)) / 1000);
    return { allowed: false, retryAfter };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const attempts = loginAttempts.get(key);
  
  if (!attempts || now - attempts.lastAttempt > LOCKOUT_DURATION) {
    loginAttempts.set(key, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(key, { count: attempts.count + 1, lastAttempt: now });
  }
}

function clearAttempts(key: string) {
  loginAttempts.delete(key);
}

export function createSessionMiddleware() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return session({
    store: new PgStore({
      conString: (process.env.NODE_ENV === "development" ? process.env.DATABASE_URL : process.env.NEON_SECRET) || process.env.DATABASE_URL,
      tableName: "admin_sessions",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "admin.sid",
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminUserId || req.session?.adminRole !== "admin") {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

function getOrCreateCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

function validateCsrfToken(req: Request, res: Response): boolean {
  const token = req.headers["x-csrf-token"] as string | undefined;
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    res.status(403).json({ error: "Forbidden: invalid CSRF token" });
    return false;
  }
  return true;
}

export function createAdminRouter(): Router {
  const router = Router();

  router.get("/session", (req: Request, res: Response) => {
    const csrfToken = getOrCreateCsrfToken(req);
    if (req.session?.adminUserId && req.session?.adminRole === "admin") {
      return res.json({
        authenticated: true,
        userId: req.session.adminUserId,
        csrfToken,
        role: req.session.adminRole,
      });
    }
    return res.json({ authenticated: false, csrfToken });
  });

  router.post("/login", async (req: Request, res: Response) => {
    if (!validateCsrfToken(req, res)) return;
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const { email, password } = parsed.data;
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const rateLimitKey = `${clientIp}:${email}`;

      const rateCheck = checkRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateCheck.retryAfter,
        });
      }

      const [user] = await db.select().from(users)
        .where(or(eq(users.email, email), eq(users.username, email)))
        .limit(1);

      if (!user) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.role !== "admin") {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        recordFailedAttempt(rateLimitKey);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      clearAttempts(rateLimitKey);

      req.session.adminUserId = user.id;
      req.session.adminRole = user.role;

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        return res.json({
          success: true,
          userId: user.id,
          username: user.username,
          role: user.role,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  router.post("/logout", (req: Request, res: Response) => {
    if (!validateCsrfToken(req, res)) return;
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("admin.sid");
      return res.json({ success: true });
    });
  });

  return router;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function adminCsrfProtection(req: Request, res: Response, next: NextFunction) {
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isStateChanging) {
    return next();
  }

  const isAdminSession = !!req.session?.adminUserId && req.session?.adminRole === "admin";
  if (!isAdminSession) {
    return next();
  }

  const token = req.headers["x-csrf-token"] as string | undefined;
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ error: "Forbidden: invalid CSRF token" });
  }

  next();
}

export async function seedAdminUser(email: string, password: string, username?: string): Promise<void> {
  const existingUser = await db.select().from(users)
    .where(or(eq(users.email, email), eq(users.username, username || email)))
    .limit(1);

  if (existingUser.length > 0) {
    const hashedPassword = await hashPassword(password);
    await db.update(users)
      .set({ password: hashedPassword, role: "admin", email })
      .where(eq(users.id, existingUser[0].id));
    console.log(`[Admin] Updated existing user (id: ${existingUser[0].id}) to admin role`);
    return;
  }

  const hashedPassword = await hashPassword(password);
  await db.insert(users).values({
    username: username || email,
    email,
    password: hashedPassword,
    role: "admin",
  });
  console.log(`[Admin] Created admin user with username "${username || 'admin'}"`);
}
