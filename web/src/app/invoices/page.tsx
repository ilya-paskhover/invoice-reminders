"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoney, parseAmountToCents } from "@/lib/format";

type Invoice = {
  id: number;
  number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  status: string;
  display_status: string;
  days_overdue: number;
  reminders_sent: number;
  last_reminder: { rule_name: string; sent_at: string } | null;
};

type Filter = "all" | "overdue" | "paid";

const badgeStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
};

function badgeLabel(s: string) {
  const v = s.toLowerCase();
  return v === "paid" ? "Paid" : v === "overdue" ? "Overdue" : "Open";
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [number, setNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async (f: Filter) => {
    try {
      setInvoices(await apiFetch<Invoice[]>(`/api/invoices?status=${f}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  async function importMock() {
    setError("");
    try {
      const r = await apiFetch<{ imported: number; skipped: number }>("/api/import/mock-stripe", {
        method: "POST",
      });
      setMessage(`Imported ${r.imported}, skipped ${r.skipped}`);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function markPaid(id: number) {
    setError("");
    try {
      await apiFetch<Invoice>(`/api/invoices/${id}/mark-paid`, { method: "POST" });
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark paid failed");
    }
  }

  async function sendReminder(id: number) {
    setError("");
    setMessage("");
    try {
      const r = await apiFetch<{ reminder: { rule_name: string } }>(`/api/invoices/${id}/send-reminder`, {
        method: "POST",
      });
      setMessage(`Reminder sent: ${r.reminder.rule_name}`);
      await load(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send reminder failed");
    }
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const cents = parseAmountToCents(amount);
    if (cents === null || cents <= 0) {
      setFormError("Amount must be a positive number like 480.00");
      return;
    }
    try {
      await apiFetch<Invoice>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          number: number.trim(),
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          amount_cents: cents,
          due_date: dueDate,
        }),
      });
      setNumber("");
      setClientName("");
      setClientEmail("");
      setAmount("");
      setDueDate("");
      setShowForm(false);
      await load(filter);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    }
  }

  const input = "mt-1 block w-full rounded border px-2 py-1";
  const btn = "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-100";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={importMock}>Import from Stripe (mock)</button>
          <button type="button" className={btn} onClick={() => setShowForm((v) => !v)}>New invoice</button>
        </div>
      </div>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {showForm && (
        <div className="mt-4 rounded border bg-white p-4">
          {formError && <p className="mb-3 text-sm text-red-700">{formError}</p>}
          <form onSubmit={createInvoice} className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="inv-number">Number</label>
              <input id="inv-number" className={input} value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-client-name">Client name</label>
              <input id="inv-client-name" className={input} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-client-email">Client email</label>
              <input id="inv-client-email" className={input} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-amount">Amount</label>
              <input id="inv-amount" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-due-date">Due date</label>
              <input id="inv-due-date" type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button type="submit" className={btn}>Create invoice</button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {([["all", "All"], ["overdue", "Overdue"], ["paid", "Paid"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            className={`${btn} ${filter === key ? "bg-gray-200 font-semibold" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <table className="mt-4 w-full border bg-white text-left text-sm">
        <thead className="border-b bg-gray-100">
          <tr>
            <th className="p-2">Number</th>
            <th className="p-2">Client</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Due date</th>
            <th className="p-2">Status</th>
            <th className="p-2">Days overdue</th>
            <th className="p-2">Reminders</th>
            <th className="p-2">Last reminder</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const paid = inv.display_status.toLowerCase() === "paid";
            return (
              <tr key={inv.id} className="border-b">
                <td className="p-2">
                  <Link href={`/invoices/${inv.id}`} className="text-blue-700 hover:underline">{inv.number}</Link>
                </td>
                <td className="p-2">{inv.client_name}</td>
                <td className="p-2">{formatMoney(inv.amount_cents, inv.currency)}</td>
                <td className="p-2">{inv.due_date.slice(0, 10)}</td>
                <td className="p-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeStyles[inv.display_status.toLowerCase()] ?? ""}`}>
                    {badgeLabel(inv.display_status)}
                  </span>
                </td>
                <td className="p-2">{!paid && inv.days_overdue > 0 ? inv.days_overdue : "-"}</td>
                <td className="p-2">{inv.reminders_sent}</td>
                <td className="p-2">{inv.last_reminder ? inv.last_reminder.rule_name : "-"}</td>
                <td className="p-2">
                  {!paid && (
                    <div className="flex gap-2">
                      <button type="button" className={btn} onClick={() => sendReminder(inv.id)}>Send next reminder</button>
                      <button type="button" className={btn} onClick={() => markPaid(inv.id)}>Mark paid</button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
