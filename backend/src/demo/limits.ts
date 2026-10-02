import type { FastifyInstance } from "fastify";
import type { Config } from "../config";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const WINDOW_MS = 60_000;
const RESET_LIMIT = 5;
export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a minute and try again.";

/** Demo only: small in-process fixed-window limiter on write requests, per client IP. */
export function registerDemoLimits(app: FastifyInstance, config: Config): void {
  if (!config.demoMode) return;
  const hits = new Map<string, { count: number; resetAt: number }>();
  app.addHook("onRequest", async (req, reply) => {
    if (!WRITE_METHODS.has(req.method)) return;
    const path = req.url.split("?")[0];
    const isReset = path === "/api/demo/reset";
    const max = isReset ? RESET_LIMIT : config.demoWriteRateLimit;
    const key = `${isReset ? "reset" : "write"}:${req.ip}`;
    const now = Date.now();
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    let h = hits.get(key);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + WINDOW_MS };
      hits.set(key, h);
    }
    h.count += 1;
    if (h.count > max) {
      reply.header("retry-after", String(Math.ceil((h.resetAt - now) / 1000)));
      return reply.code(429).send({ error: RATE_LIMIT_MESSAGE });
    }
  });
}
