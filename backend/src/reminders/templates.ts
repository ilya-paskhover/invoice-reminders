import type { Config } from "../config";

export const ALLOWED_PLACEHOLDERS = [
  "client_name",
  "invoice_number",
  "amount",
  "due_date",
  "days_overdue",
  "business_name",
  "pay_link",
] as const;

export type TemplateVars = Record<(typeof ALLOWED_PLACEHOLDERS)[number], string>;

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function findUnknownPlaceholders(template: string): string[] {
  const allowed = new Set<string>(ALLOWED_PLACEHOLDERS);
  const unknown: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER_RE)) {
    if (!allowed.has(m[1]!) && !unknown.includes(m[1]!)) unknown.push(m[1]!);
  }
  return unknown;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : whole,
  );
}

export interface TemplateInvoice {
  client_name: string;
  number: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  pay_token: string;
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
}

export function buildTemplateVars(
  invoice: TemplateInvoice,
  asOf: string,
  config: Pick<Config, "businessName" | "publicApiUrl">,
): TemplateVars {
  const currency = String(invoice.currency).trim().toUpperCase();
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    invoice.amount_cents / 100,
  );
  const days = Math.max(0, dayNumber(asOf) - dayNumber(invoice.due_date));
  return {
    client_name: invoice.client_name,
    invoice_number: invoice.number,
    amount,
    due_date: invoice.due_date,
    days_overdue: String(days),
    business_name: config.businessName,
    pay_link: `${config.publicApiUrl}/pay/${invoice.pay_token}`,
  };
}
