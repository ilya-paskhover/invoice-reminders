import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type pg from "pg";
import type { Config } from "./config";
import type { EmailSender } from "./email/types";
import { registerHealthRoutes } from "./routes/health";
import { registerInvoiceRoutes } from "./routes/invoices";
import { registerImportRoutes } from "./routes/imports";
import { MockStripeSource } from "./sources/mock-stripe";

export interface AppDeps {
  pool: pg.Pool;
  emailSender: EmailSender;
  config: Config;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: deps.config.webOrigin });
  registerHealthRoutes(app, deps.pool);
  registerInvoiceRoutes(app, deps.pool, deps.config);
  registerImportRoutes(app, deps.pool, new MockStripeSource());
  return app;
}
