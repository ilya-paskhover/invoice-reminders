import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import type { Config } from "../config";
import { todayUtc } from "../dates";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, "invalid date");

const createSchema = z.object({
  number: z.string().min(1).max(50),
  client_name: z.string().min(1).max(200),
  client_email: z.email().max(254),
  amount_cents: z.number().int().positive().max(2147483647),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, "must be 3 letters")
    .optional(),
  issue_date: dateStr.optional(),
  due_date: dateStr,
});

const listQuery = z.object({
  status: z.enum(["all", "overdue", "paid", "unpaid"]).default("all"),
});

export function invoiceSelect(asOfParam: string): string {
  return `
SELECT i.id, i.number, i.client_name, i.client_email, i.amount_cents, i.currency,
  i.issue_date, i.due_date, i.status, i.paid_at, i.paid_via, i.source, i.external_id,
  i.pay_token, i.created_at,
  CASE WHEN i.status = 'unpaid' AND (${asOfParam}::date - i.due_date) >= 1
       THEN (${asOfParam}::date - i.due_date) ELSE 0 END AS days_overdue,
  (SELECT count(*)::int FROM reminders r WHERE r.invoice_id = i.id AND r.status = 'sent') AS reminders_sent,
  (SELECT json_build_object('rule_name', r.rule_name, 'sent_at', r.sent_at)
     FROM reminders r WHERE r.invoice_id = i.id AND r.status = 'sent'
     ORDER BY r.sent_at DESC, r.id DESC LIMIT 1) AS last_reminder
FROM invoices i`;
}

export function toInvoice(row: any, config: Config) {
  const { pay_token, ...rest } = row;
  const display_status =
    row.status === "paid" ? "paid" : row.days_overdue >= 1 ? "overdue" : "open";
  return {
    ...rest,
    currency: String(row.currency).trim(),
    display_status,
    pay_url: `${config.publicApiUrl}/pay/${pay_token}`,
  };
}

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.code(400).send({
    error: "Validation failed",
    details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  });
}

export function newPayToken(): string {
  return randomBytes(16).toString("hex");
}

export function registerInvoiceRoutes(app: FastifyInstance, pool: pg.Pool, config: Config): void {
  async function fetchOne(id: number) {
    const { rows } = await pool.query(`${invoiceSelect("$2")} WHERE i.id = $1`, [id, todayUtc()]);
    return rows[0] ? toInvoice(rows[0], config) : null;
  }

  function parseId(raw: string): number | null {
    return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  }

  app.get("/api/invoices", async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return validationError(reply, q.error);
    const where =
      q.data.status === "all"
        ? ""
        : q.data.status === "paid"
          ? "WHERE i.status = 'paid'"
          : q.data.status === "unpaid"
            ? "WHERE i.status = 'unpaid'"
            : "WHERE i.status = 'unpaid' AND ($1::date - i.due_date) >= 1";
    const { rows } = await pool.query(
      `${invoiceSelect("$1")} ${where} ORDER BY i.created_at DESC, i.id DESC`,
      [todayUtc()],
    );
    return rows.map((r) => toInvoice(r, config));
  });

  app.post("/api/invoices", async (req, reply) => {
    const p = createSchema.safeParse(req.body ?? {});
    if (!p.success) return validationError(reply, p.error);
    const d = p.data;
    if (config.demoMode) {
      const c = await pool.query("SELECT count(*)::int AS n FROM invoices");
      if (c.rows[0].n >= config.demoMaxInvoices) {
        return reply.code(409).send({
          error: `Demo limit reached: at most ${config.demoMaxInvoices} invoices. Use Reset demo data.`,
        });
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO invoices (number, client_name, client_email, amount_cents, currency, issue_date, due_date, pay_token)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, current_date),$7,$8) RETURNING id`,
      [
        d.number,
        d.client_name,
        d.client_email,
        d.amount_cents,
        (d.currency ?? "USD").toUpperCase(),
        d.issue_date ?? null,
        d.due_date,
        newPayToken(),
      ],
    );
    return reply.code(201).send(await fetchOne(rows[0].id));
  });

  app.get<{ Params: { id: string } }>("/api/invoices/:id", async (req, reply) => {
    const id = parseId(req.params.id);
    const inv = id === null ? null : await fetchOne(id);
    if (!inv) return reply.code(404).send({ error: "Invoice not found" });
    const { rows } = await pool.query(
      `SELECT r.id, r.invoice_id, i.number AS invoice_number, i.client_name, r.rule_id, r.rule_name,
              r.rule_offset_days, r.trigger, r.to_email, r.subject, r.body, r.status, r.error, r.sent_at
       FROM reminders r JOIN invoices i ON i.id = r.invoice_id
       WHERE r.invoice_id = $1 ORDER BY r.sent_at DESC, r.id DESC`,
      [id],
    );
    return { ...inv, reminders: rows };
  });

  app.post<{ Params: { id: string } }>("/api/invoices/:id/mark-paid", async (req, reply) => {
    const id = parseId(req.params.id);
    if (id === null) return reply.code(404).send({ error: "Invoice not found" });
    await pool.query(
      `UPDATE invoices SET status = 'paid', paid_at = now(), paid_via = 'manual'
       WHERE id = $1 AND status = 'unpaid'`,
      [id],
    );
    const inv = await fetchOne(id);
    if (!inv) return reply.code(404).send({ error: "Invoice not found" });
    return inv;
  });
}
