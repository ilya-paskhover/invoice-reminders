import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { todayUtc } from "../dates";

function esc(v: unknown): string {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body style="font-family:sans-serif;max-width:480px;margin:40px auto">${body}</body></html>`;
}

function html(reply: FastifyReply, code: number, content: string) {
  return reply.code(code).type("text/html; charset=utf-8").send(content);
}

const notFound = () => page("Not found", "<h1>Payment link not found</h1>");

const PAID_AFTER = `status='paid' AND EXISTS (SELECT 1 FROM reminders r WHERE r.invoice_id=invoices.id AND r.status='sent' AND r.sent_at <= invoices.paid_at)`;

export function registerPayRoutes(app: FastifyInstance, pool: pg.Pool) {
  async function load(token: string) {
    const { rows } = await pool.query("SELECT * FROM invoices WHERE pay_token = $1", [token]);
    return rows[0] as any | undefined;
  }

  app.get<{ Params: { token: string } }>("/pay/:token", async (req, reply) => {
    const inv = await load(req.params.token);
    if (!inv) return html(reply, 404, notFound());
    const amount = money(inv.amount_cents, String(inv.currency).trim());
    const head = `<h1>Pay invoice ${esc(inv.number)}</h1><p>${esc(inv.client_name)}</p><p>${esc(amount)}</p>`;
    if (inv.status === "paid") {
      return html(reply, 200, page(`Invoice ${inv.number}`, `${head}<p>This invoice is already paid.</p>`));
    }
    return html(
      reply,
      200,
      page(
        `Invoice ${inv.number}`,
        `${head}<form method="POST" action="/pay/${esc(encodeURIComponent(inv.pay_token))}"><button type="submit">Pay ${esc(amount)} (mock)</button></form>`,
      ),
    );
  });

  app.post<{ Params: { token: string } }>("/pay/:token", async (req, reply) => {
    const inv = await load(req.params.token);
    if (!inv) return html(reply, 404, notFound());
    if (inv.status !== "paid") {
      await pool.query(
        "UPDATE invoices SET status='paid', paid_at=now(), paid_via='pay_link' WHERE id=$1 AND status<>'paid'",
        [inv.id],
      );
    }
    return html(reply, 200, page("Payment received", "<h1>Payment received. Thank you!</h1>"));
  });

  app.get("/api/stats", async () => {
    const { rows } = await pool.query(
      `SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status='unpaid'),0) AS outstanding_cents,
        COUNT(*) FILTER (WHERE status='unpaid' AND $1::date - due_date >= 1) AS overdue_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE status='unpaid' AND $1::date - due_date >= 1),0) AS overdue_cents,
        COUNT(*) FILTER (WHERE ${PAID_AFTER}) AS paid_after_reminder_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE ${PAID_AFTER}),0) AS paid_after_reminder_cents,
        (SELECT COUNT(*) FROM reminders WHERE status='sent') AS reminders_sent
       FROM invoices`,
      [todayUtc()],
    );
    const r = rows[0];
    return {
      outstanding_cents: Number(r.outstanding_cents),
      overdue_count: Number(r.overdue_count),
      overdue_cents: Number(r.overdue_cents),
      reminders_sent: Number(r.reminders_sent),
      paid_after_reminder_count: Number(r.paid_after_reminder_count),
      paid_after_reminder_cents: Number(r.paid_after_reminder_cents),
      currency: "USD",
    };
  });
}
