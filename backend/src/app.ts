import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type pg from "pg";
import type { Config } from "./config";
import type { EmailSender } from "./email/types";
import { registerHealthRoutes } from "./routes/health";
import { registerInvoiceRoutes } from "./routes/invoices";
import { registerImportRoutes } from "./routes/imports";
import { registerRuleRoutes } from "./routes/rules";
import { registerReminderRoutes } from "./routes/reminders";
import { registerSchedulerRoutes } from "./routes/scheduler";
import formbody from "@fastify/formbody";
import { registerPayRoutes } from "./routes/pay";
import { registerDemoRoutes } from "./routes/demo";
import { registerMetaRoutes } from "./routes/meta";
import { registerDemoLimits } from "./demo/limits";
import { Scheduler } from "./reminders/scheduler";
import { MockStripeSource } from "./sources/mock-stripe";

export interface AppDeps {
  pool: pg.Pool;
  emailSender: EmailSender;
  config: Config;
  /** Optional: server.ts passes the started scheduler so GET /api/scheduler reflects it. buildApp never starts it. */
  scheduler?: Scheduler;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: deps.config.trustProxy,
    ...(deps.config.demoMode ? { bodyLimit: 65536 } : {}),
  });
  await app.register(cors, {
    origin: deps.config.webOrigin,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(formbody);
  registerDemoLimits(app, deps.config);
  const scheduler = deps.scheduler ?? new Scheduler(deps);
  registerHealthRoutes(app, deps.pool);
  registerInvoiceRoutes(app, deps.pool, deps.config);
  registerImportRoutes(app, deps.pool, new MockStripeSource());
  registerRuleRoutes(app, deps.pool, deps.config);
  registerReminderRoutes(app, deps);
  registerSchedulerRoutes(app, scheduler);
  registerPayRoutes(app, deps.pool, deps.config);
  registerMetaRoutes(app, deps.pool, deps.config);
  registerDemoRoutes(app, deps.pool, deps.config);
  return app;
}
