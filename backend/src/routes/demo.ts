import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { Config } from "../config";
import { resetDemoData } from "../demo/reset";

export function registerDemoRoutes(app: FastifyInstance, pool: pg.Pool, config: Config): void {
  if (!config.demoMode) return;
  app.post("/api/demo/reset", async () => resetDemoData(pool, config));
}
