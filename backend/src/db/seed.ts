import type { Queryable } from "../sources/import";

export async function seedDefaultRules(pool: Queryable): Promise<void> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM reminder_rules");
  if (rows[0].n > 0) return;
  const rules = [
    [
      "Friendly nudge",
      1,
      "Friendly reminder: invoice {{invoice_number}} is past due",
      "Hi {{client_name}},\n\nJust a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. You can pay online here: {{pay_link}}\n\nThanks,\n{{business_name}}",
    ],
    [
      "Firm reminder",
      10,
      "Reminder: invoice {{invoice_number}} is {{days_overdue}} days overdue",
      "Hi {{client_name}},\n\nInvoice {{invoice_number}} was due on {{due_date}} and is now {{days_overdue}} days overdue. Please arrange payment of {{amount}} as soon as possible: {{pay_link}}\n\nThank you,\n{{business_name}}",
    ],
    [
      "Final notice",
      30,
      "Final notice: invoice {{invoice_number}} is {{days_overdue}} days overdue",
      "Hi {{client_name}},\n\nThis is our final reminder. Invoice {{invoice_number}} for {{amount}} is {{days_overdue}} days overdue. Please pay immediately: {{pay_link}}\n\nRegards,\n{{business_name}}",
    ],
  ] as const;
  for (const r of rules) {
    await pool.query(
      "INSERT INTO reminder_rules (name, offset_days, subject_template, body_template) VALUES ($1,$2,$3,$4)",
      [...r],
    );
  }
}
