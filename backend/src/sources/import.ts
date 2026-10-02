import type { InvoiceSource } from "./types";
import { newPayToken } from "../routes/invoices";

export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rowCount?: number | null; rows: any[] }>;
}

export async function importInvoices(
  db: Queryable,
  source: InvoiceSource,
  today: string,
): Promise<{ imported: number; skipped: number }> {
  const items = await source.fetchInvoices(today);
  let imported = 0;
  let skipped = 0;
  for (const it of items) {
    const res = await db.query(
      `INSERT INTO invoices (number, client_name, client_email, amount_cents, currency, issue_date, due_date, source, external_id, pay_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'mock_stripe',$8,$9)
       ON CONFLICT (source, external_id) DO NOTHING`,
      [
        it.number,
        it.client_name,
        it.client_email,
        it.amount_cents,
        it.currency,
        it.issue_date,
        it.due_date,
        it.external_id,
        newPayToken(),
      ],
    );
    if (res.rowCount) imported++;
    else skipped++;
  }
  return { imported, skipped };
}
