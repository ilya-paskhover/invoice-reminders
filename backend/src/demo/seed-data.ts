export interface SeedReminder {
  rule: "Friendly nudge" | "Firm reminder" | "Final notice";
  offset: number;
}

export interface SeedInvoice {
  number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  due_in_days: number;
  paid: null | { via: "pay_link" | "manual"; days_after_due: number; hour: number };
  reminders: SeedReminder[];
}

const F: SeedReminder = { rule: "Friendly nudge", offset: 1 };
const M: SeedReminder = { rule: "Firm reminder", offset: 10 };
const L: SeedReminder = { rule: "Final notice", offset: 30 };

export const MANUAL_SEED_INVOICES: SeedInvoice[] = [
  { number: "INV-2041", client_name: "Harbor & Pine Interiors", client_email: "ap@harborpine.test", amount_cents: 320000, due_in_days: -45, paid: null, reminders: [F, M, L] },
  { number: "INV-2042", client_name: "Maple Street Bakery", client_email: "owner@maplestreet.test", amount_cents: 65000, due_in_days: -20, paid: { via: "pay_link", days_after_due: 12, hour: 15 }, reminders: [F, M] },
  { number: "INV-2043", client_name: "Kestrel Fitness", client_email: "billing@kestrelfit.test", amount_cents: 150000, due_in_days: -9, paid: { via: "pay_link", days_after_due: 3, hour: 15 }, reminders: [F] },
  { number: "INV-2044", client_name: "Oakline Legal", client_email: "finance@oakline.test", amount_cents: 210000, due_in_days: 14, paid: null, reminders: [] },
  { number: "INV-2045", client_name: "Copperleaf Media", client_email: "accounts@copperleaf.test", amount_cents: 98000, due_in_days: -5, paid: { via: "manual", days_after_due: -2, hour: 10 }, reminders: [] },
];

/** Reminder history for imported Stripe invoices, by invoice number. */
export const STRIPE_SEED_REMINDERS: Record<string, SeedReminder[]> = {
  "STR-1002": [F],
};
