import type { FastifyInstance } from "fastify";
import type pg from "pg";

export function registerHealthRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get("/api/health", async (_req, reply) => {
    try {
      await pool.query("SELECT 1");
      return { status: "ok", db: "ok" };
    } catch {
      return reply.code(503).send({ status: "ok", db: "error" });
    }
  });
}
