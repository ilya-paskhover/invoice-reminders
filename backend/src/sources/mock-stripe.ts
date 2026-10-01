import fs from "node:fs/promises";
import type { ExternalInvoice, InvoiceSource } from "./types";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface FixtureRow {
  external_id: string;
  number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  currency: string;
  due_in_days: number;
}

export class MockStripeSource implements InvoiceSource {
  name = "mock_stripe";

  async fetchInvoices(today: string): Promise<ExternalInvoice[]> {
    const raw = await fs.readFile(
      new URL("./fixtures/mock-stripe-invoices.json", import.meta.url),
      "utf8",
    );
    const rows = JSON.parse(raw) as FixtureRow[];
    return rows.map((r) => ({
      external_id: r.external_id,
      number: r.number,
      client_name: r.client_name,
      client_email: r.client_email,
      amount_cents: r.amount_cents,
      currency: r.currency,
      issue_date: addDays(today, r.due_in_days - 30),
      due_date: addDays(today, r.due_in_days),
    }));
  }
}
