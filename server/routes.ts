import type { Express } from "express";
import { type Server } from "http";
import { registerTwilioRoutes } from "./twilioRoutes";
import shopifyAuthRouter from "./shopify-auth";
import { resolveStoreContext } from "./store-middleware";
import { apiRateLimiter, authenticatedApiLimiter } from "./middleware/rate-limit";
import { createSessionMiddleware, createAdminRouter, adminCsrfProtection } from "./admin-auth";

import { createAdminRoutes } from "./routes/admin";
import { createProxyRoutes } from "./routes/proxy";
import { createStoreRoutes } from "./routes/stores";
import { createProductRoutes } from "./routes/products";
import { createPageRoutes } from "./routes/pages";
import { createAnalyticsRoutes } from "./routes/analytics";
import { createAbTestRoutes } from "./routes/ab-tests";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const sessionMiddleware = createSessionMiddleware();
  app.use(sessionMiddleware);

  app.use(adminCsrfProtection);

  app.use("/api/admin", authenticatedApiLimiter, createAdminRouter());

  app.use(createAdminRoutes());

  app.use(shopifyAuthRouter);

  app.use(resolveStoreContext);

  app.use("/api", apiRateLimiter);

  app.use(createProxyRoutes());

  app.use(createStoreRoutes());

  app.use(createProductRoutes());

  app.use(createPageRoutes());

  app.use(createAnalyticsRoutes());

  app.use(createAbTestRoutes());

  registerTwilioRoutes(app);

  return httpServer;
}
