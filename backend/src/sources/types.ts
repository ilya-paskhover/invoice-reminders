export interface ExternalInvoice {
  external_id: string;
  number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  currency: string;
  issue_date: string;
  due_date: string;
}

export interface InvoiceSource {
  name: string;
  fetchInvoices(today: string): Promise<ExternalInvoice[]>;
}
