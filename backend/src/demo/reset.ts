import type pg from "pg";
import type { Config } from "../config";
import { todayUtc } from "../dates";
import { seedDefaultRules } from "../db/seed";
import { importInvoices } from "../sources/import";
import { MockStripeSource } from "../sources/mock-stripe";
import { newPayToken } from "../routes/invoices";
import { buildTemplateVars, renderTemplate } from "../reminders/templates";
import { MANUAL_SEED_INVOICES, STRIPE_SEED_REMINDERS, type SeedReminder } from "./seed-data";

export interface DemoResetResult {
  reset_at: string;
  invoices: number;
  reminders: number;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function resetDemoData(
  pool: pg.Pool,
  config: Config,
  today: string = todayUtc(),
): Promise<DemoResetResult> {
  if (!config.demoMode) throw new Error("Demo reset refused: DEMO_MODE is off");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(424242)");
    await client.query("TRUNCATE reminders, invoices, reminder_rules RESTART IDENTITY CASCADE");
    await seedDefaultRules(client);
    await importInvoices(client, new MockStripeSource(), today);

    const rules = (
      await client.query(
        "SELECT id, name, offset_days, subject_template, body_template FROM reminder_rules",
      )
    ).rows;
    const ruleByName = new Map<string, any>(rules.map((r) => [r.name, r]));

    const addReminders = async (inv: any, list: SeedReminder[]) => {
      for (const sr of list) {
        const rule = ruleByName.get(sr.rule);
        const sentDate = addDays(inv.due_date, sr.offset);
        const vars = buildTemplateVars(inv, sentDate, config);
        await client.query(
          `INSERT INTO reminders (invoice_id, rule_id, rule_name, rule_offset_days, trigger, to_email, subject, body, status, sent_at)
           VALUES ($1,$2,$3,$4,'scheduled',$5,$6,$7,'sent',$8)`,
          [
            inv.id,
            rule.id,
            rule.name,
            rule.offset_days,
            inv.client_email,
            renderTemplate(rule.subject_template, vars),
            renderTemplate(rule.body_template, vars),
            `${sentDate}T09:00:00Z`,
          ],
        );
      }
    };

    const cols = "id, number, client_name, client_email, amount_cents, currency, due_date, pay_token";
    for (const s of MANUAL_SEED_INVOICES) {
      const due = addDays(today, s.due_in_days);
      const paidAt = s.paid
        ? `${addDays(due, s.paid.days_after_due)}T${String(s.paid.hour).padStart(2, "0")}:00:00Z`
        : null;
      const { rows } = await client.query(
        `INSERT INTO invoices (number, client_name, client_email, amount_cents, currency, issue_date, due_date, status, paid_at, paid_via, source, pay_token)
         VALUES ($1,$2,$3,$4,'USD',$5,$6,$7,$8,$9,'manual',$10) RETURNING ${cols}`,
        [
          s.number,
          s.client_name,
          s.client_email,
          s.amount_cents,
          addDays(due, -30),
          due,
          s.paid ? "paid" : "unpaid",
          paidAt,
          s.paid ? s.paid.via : null,
          newPayToken(),
        ],
      );
      await addReminders(rows[0], s.reminders);
    }
    for (const [number, list] of Object.entries(STRIPE_SEED_REMINDERS)) {
      const { rows } = await client.query(
        `SELECT ${cols} FROM invoices WHERE number = $1 AND source = 'mock_stripe'`,
        [number],
      );
      await addReminders(rows[0], list);
    }

    const state = await client.query(
      `INSERT INTO demo_state (id, last_reset_on, last_reset_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET last_reset_on = EXCLUDED.last_reset_on, last_reset_at = EXCLUDED.last_reset_at
       RETURNING last_reset_at`,
      [today],
    );
    const counts = (
      await client.query(
        "SELECT (SELECT count(*)::int FROM invoices) AS invoices, (SELECT count(*)::int FROM reminders) AS reminders",
      )
    ).rows[0];
    await client.query("COMMIT");
    return {
      reset_at: new Date(state.rows[0].last_reset_at).toISOString(),
      invoices: counts.invoices,
      reminders: counts.reminders,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkAndResetIfStale(pool: pg.Pool, config: Config): Promise<boolean> {
  if (!config.demoMode) return false;
  const today = todayUtc();
  const { rows } = await pool.query("SELECT last_reset_on FROM demo_state WHERE id = 1");
  if (rows.length && String(rows[0].last_reset_on) >= today) return false;
  await resetDemoData(pool, config, today);
  return true;
}
