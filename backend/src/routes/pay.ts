import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { todayUtc } from "../dates";
import type { Config } from "../config";

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

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#4338ca"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><rect x="7" y="9" width="18" height="14" rx="2.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M8 11l8 6 8-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const CSS = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#f1f5f9;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:420px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 25px -5px rgba(15,23,42,.1),0 4px 6px -2px rgba(15,23,42,.05);padding:32px 28px;text-align:center}
.biz{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#4f46e5;margin:0 0 16px}
h1{font-size:22px;line-height:1.3;margin:0 0 6px;font-weight:700;word-break:break-word}
.client{margin:0;color:#475569}
.amount{font-size:40px;font-weight:700;margin:20px 0 4px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.due{margin:0 0 24px;color:#64748b;font-size:14px}
button{display:block;width:100%;border:0;border-radius:10px;background:#4f46e5;color:#fff;font:inherit;font-weight:600;padding:12px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.15)}
button:hover{background:#4338ca}
button:focus-visible{outline:3px solid #a5b4fc;outline-offset:2px}
.note{margin:16px 0 0;font-size:13px;color:#64748b}
.status{margin:20px 0 0;font-size:16px;font-weight:600;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 16px}
.icon{display:block;margin:0 auto 16px}
@media (max-width:480px){.card{padding:24px 20px}.amount{font-size:34px}}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>${CSS}</style></head><body><main class="card">${body}</main></body></html>`;
}

function html(reply: FastifyReply, code: number, content: string) {
  return reply.code(code).type("text/html; charset=utf-8").send(content);
}

const notFound = () => page("Not found", "<h1>Payment link not found</h1>");

const PAID_AFTER = `status='paid' AND EXISTS (SELECT 1 FROM reminders r WHERE r.invoice_id=invoices.id AND r.status='sent' AND r.sent_at <= invoices.paid_at)`;

export function registerPayRoutes(app: FastifyInstance, pool: pg.Pool, config: Config) {
  const biz = `<p class="biz">${esc(config.businessName)}</p>`;
  const sendFavicon = async (_req: unknown, reply: FastifyReply) =>
    reply.type("image/svg+xml").send(FAVICON_SVG);
  app.get("/favicon.svg", sendFavicon);
  app.get("/favicon.ico", sendFavicon);

  async function load(token: string) {
    const { rows } = await pool.query(
      "SELECT *, to_char(due_date, 'YYYY-MM-DD') AS due_str FROM invoices WHERE pay_token = $1",
      [token],
    );
    return rows[0] as any | undefined;
  }

  app.get<{ Params: { token: string } }>("/pay/:token", async (req, reply) => {
    const inv = await load(req.params.token);
    if (!inv) return html(reply, 404, notFound());
    const amount = money(inv.amount_cents, String(inv.currency).trim());
    const head = `${biz}<h1>Pay invoice ${esc(inv.number)}</h1><p class="client">${esc(inv.client_name)}</p><p class="amount">${esc(amount)}</p><p class="due">Due ${esc(inv.due_str)}</p>`;
    if (inv.status === "paid") {
      return html(reply, 200, page(`Invoice ${inv.number}`, `${head}<p class="status">This invoice is already paid.</p>`));
    }
    return html(
      reply,
      200,
      page(
        `Invoice ${inv.number}`,
        `${head}<form method="POST" action="/pay/${esc(encodeURIComponent(inv.pay_token))}"><button type="submit">Pay ${esc(amount)} (mock)</button></form><p class="note">Mock checkout. No real payment is taken.</p>`,
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
    return html(reply, 200, page(
        "Payment received",
        `${biz}<svg class="icon" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="28" fill="#d1fae5"/><path d="M17 29l8 8 14-16" fill="none" stroke="#059669" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><h1>Payment received. Thank you!</h1>`,
      ));
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
