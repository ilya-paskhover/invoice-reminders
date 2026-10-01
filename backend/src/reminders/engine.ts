import type pg from "pg";
import type { Config } from "../config";
import type { EmailSender } from "../email/types";
import { todayUtc } from "../dates";
import { buildTemplateVars, renderTemplate } from "./templates";

export interface EngineDeps {
  pool: pg.Pool;
  emailSender: EmailSender;
  config: Config;
}

export interface RunResultItem {
  invoice_id: number;
  invoice_number: string;
  rule_name: string;
  status: "sent" | "failed";
}

export interface RunResult {
  as_of: string;
  checked: number;
  sent: number;
  failed: number;
  results: RunResultItem[];
}

interface Rule {
  id: number;
  name: string;
  offset_days: number;
  subject_template: string;
  body_template: string;
}

const REMINDER_SELECT = `
SELECT r.id, r.invoice_id, i.number AS invoice_number, i.client_name, r.rule_id, r.rule_name,
       r.rule_offset_days, r.trigger, r.to_email, r.subject, r.body, r.status, r.error, r.sent_at
FROM reminders r JOIN invoices i ON i.id = r.invoice_id`;

export async function fetchReminder(pool: pg.Pool, id: number) {
  const { rows } = await pool.query(`${REMINDER_SELECT} WHERE r.id = $1`, [id]);
  return rows[0];
}

// Ordered by offset_days asc, id asc so the first match wins ties.
async function activeRules(pool: pg.Pool): Promise<Rule[]> {
  const { rows } = await pool.query(
    `SELECT id, name, offset_days, subject_template, body_template
     FROM reminder_rules WHERE active ORDER BY offset_days ASC, id ASC`,
  );
  return rows;
}

/** Renders, sends, and logs one reminder (sent or failed). */
async function attemptSend(
  deps: EngineDeps,
  invoice: any,
  rule: Rule,
  asOf: string,
  trigger: "scheduled" | "manual",
): Promise<{ id: number; ok: boolean }> {
  const vars = buildTemplateVars(invoice, asOf, deps.config);
  const subject = renderTemplate(rule.subject_template, vars);
  const body = renderTemplate(rule.body_template, vars);
  let error: string | null = null;
  try {
    await deps.emailSender.send({
      to: invoice.client_email,
      from: deps.config.fromEmail,
      subject,
      text: body,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const { rows } = await deps.pool.query(
    `INSERT INTO reminders (invoice_id, rule_id, rule_name, rule_offset_days, trigger, to_email, subject, body, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      invoice.id,
      rule.id,
      rule.name,
      rule.offset_days,
      trigger,
      invoice.client_email,
      subject,
      body,
      error === null ? "sent" : "failed",
      error,
    ],
  );
  return { id: rows[0].id, ok: error === null };
}

export async function runDueReminders(deps: EngineDeps, asOf: string = todayUtc()): Promise<RunResult> {
  const { rows: invoices } = await deps.pool.query(
    `SELECT i.id, i.number, i.client_name, i.client_email, i.amount_cents, i.currency, i.due_date, i.pay_token,
            ($1::date - i.due_date)::int AS days_overdue,
            COALESCE((SELECT max(r.rule_offset_days) FROM reminders r
                      WHERE r.invoice_id = i.id AND r.status = 'sent'), -1) AS last_offset
     FROM invoices i
     WHERE i.status = 'unpaid' AND ($1::date - i.due_date) >= 1
     ORDER BY i.id ASC`,
    [asOf],
  );
  const rules = await activeRules(deps.pool);
  const result: RunResult = { as_of: asOf, checked: invoices.length, sent: 0, failed: 0, results: [] };
  for (const inv of invoices) {
    let chosen: Rule | undefined;
    for (const r of rules) {
      if (r.offset_days <= inv.days_overdue && r.offset_days > inv.last_offset) {
        if (!chosen || r.offset_days > chosen.offset_days) chosen = r;
      }
    }
    if (!chosen) continue;
    const out = await attemptSend(deps, inv, chosen, asOf, "scheduled");
    if (out.ok) result.sent++;
    else result.failed++;
    result.results.push({
      invoice_id: inv.id,
      invoice_number: inv.number,
      rule_name: chosen.name,
      status: out.ok ? "sent" : "failed",
    });
  }
  return result;
}

export type ManualOutcome =
  | { kind: "not_found" }
  | { kind: "conflict"; error: string }
  | { kind: "sent"; reminder: any }
  | { kind: "failed"; reminder: any };

export async function sendNextReminder(deps: EngineDeps, invoiceId: number): Promise<ManualOutcome> {
  const asOf = todayUtc();
  const { rows } = await deps.pool.query(
    `SELECT i.id, i.number, i.client_name, i.client_email, i.amount_cents, i.currency, i.due_date, i.pay_token, i.status,
            COALESCE((SELECT max(r.rule_offset_days) FROM reminders r
                      WHERE r.invoice_id = i.id AND r.status = 'sent'), -1) AS last_offset
     FROM invoices i WHERE i.id = $1`,
    [invoiceId],
  );
  const inv = rows[0];
  if (!inv) return { kind: "not_found" };
  if (inv.status === "paid") return { kind: "conflict", error: "Invoice is already paid" };
  const rules = await activeRules(deps.pool);
  if (rules.length === 0) return { kind: "conflict", error: "No active reminder rules" };
  const rule =
    rules.find((r) => r.offset_days > inv.last_offset) ??
    rules.reduce((best, r) => (r.offset_days > best.offset_days ? r : best));
  const out = await attemptSend(deps, inv, rule, asOf, "manual");
  const reminder = await fetchReminder(deps.pool, out.id);
  return out.ok ? { kind: "sent", reminder } : { kind: "failed", reminder };
}

export async function listReminders(pool: pg.Pool, limit: number) {
  const { rows } = await pool.query(`${REMINDER_SELECT} ORDER BY r.sent_at DESC, r.id DESC LIMIT $1`, [limit]);
  return rows;
}
