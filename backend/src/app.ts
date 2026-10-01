import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type pg from "pg";
import type { Config } from "./config";
import type { EmailSender } from "./email/types";
import { registerHealthRoutes } from "./routes/health";

export interface AppDeps {
  pool: pg.Pool;
  emailSender: EmailSender;
  config: Config;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: deps.config.webOrigin });
  registerHealthRoutes(app, deps.pool);
  return app;
}
