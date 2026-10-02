import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "../config";

const outboxQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

function nextMidnightUtc(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

export function registerMetaRoutes(app: FastifyInstance, pool: pg.Pool, config: Config): void {
  app.get("/api/meta", async () => {
    let lastResetAt: string | null = null;
    if (config.demoMode) {
      const { rows } = await pool.query("SELECT last_reset_at FROM demo_state WHERE id = 1");
      if (rows[0]) lastResetAt = new Date(rows[0].last_reset_at).toISOString();
    }
    return {
      demo_mode: config.demoMode,
      email_delivery: config.demoMode ? "suppressed" : config.emailProvider,
      last_reset_at: lastResetAt,
      next_reset_at: config.demoMode ? nextMidnightUtc() : null,
    };
  });

  app.get("/api/outbox", async (req, reply: FastifyReply) => {
    const q = outboxQuery.safeParse(req.query);
    if (!q.success) {
      return reply.code(400).send({
        error: "Validation failed",
        details: q.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }
    const { rows } = await pool.query(
      `SELECT r.id, r.invoice_id, i.number AS invoice_number, i.client_name, r.rule_name, r.trigger,
              r.to_email, r.subject, r.body, r.status, r.error, r.sent_at, i.pay_token
       FROM reminders r JOIN invoices i ON i.id = r.invoice_id
       ORDER BY r.sent_at DESC, r.id DESC LIMIT $1`,
      [q.data.limit],
    );
    return rows.map(({ pay_token, to_email, ...r }) => ({
      id: r.id,
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      client_name: r.client_name,
      rule_name: r.rule_name,
      trigger: r.trigger,
      from_email: config.fromEmail,
      to_email,
      subject: r.subject,
      body: r.body,
      pay_url: `${config.publicApiUrl}/pay/${pay_token}`,
      status: r.status,
      error: r.error,
      sent_at: r.sent_at,
    }));
  });
}
