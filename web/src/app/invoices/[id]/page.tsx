"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Reminder = {
  id: number;
  rule_name: string;
  trigger: string;
  status: string;
  subject: string;
  sent_at: string;
};

type Invoice = {
  id: number;
  number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  currency: string;
  due_date: string;
  display_status: string;
  days_overdue: number;
  pay_url: string;
  reminders: Reminder[];
};

const badgeStyles: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  overdue: "bg-red-100 text-red-800",
  paid: "bg-green-100 text-green-800",
};

function badgeLabel(s: string) {
  const v = s.toLowerCase();
  return v === "paid" ? "Paid" : v === "overdue" ? "Overdue" : "Open";
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setInvoice(await apiFetch<Invoice>(`/api/invoices/${id}`));
      setNotFound(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Failed to load invoice";
      if (/not found|\(404\)/i.test(m)) setNotFound(true);
      else setError(m);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReminder() {
    setError("");
    setMessage("");
    try {
      const r = await apiFetch<{ reminder: { rule_name: string } }>(`/api/invoices/${id}/send-reminder`, {
        method: "POST",
      });
      setMessage(`Reminder sent: ${r.reminder.rule_name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send reminder failed");
    }
    await load();
  }

  async function markPaid() {
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/invoices/${id}/mark-paid`, { method: "POST" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark paid failed");
    }
    await load();
  }

  const btn = "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-100";
  const paid = invoice?.display_status.toLowerCase() === "paid";

  return (
    <div>
      <Link href="/invoices" className="text-sm text-blue-700 hover:underline">Back to invoices</Link>

      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {notFound && <p className="mt-4">Invoice not found</p>}

      {invoice && (
        <div className="mt-4">
          <h1 className="text-2xl font-semibold">Invoice {invoice.number}</h1>
          <div className="mt-3 space-y-1 text-sm">
            <p>Client: {invoice.client_name} ({invoice.client_email})</p>
            <p>Amount: {formatMoney(invoice.amount_cents, invoice.currency)}</p>
            <p>Due date: {invoice.due_date.slice(0, 10)}</p>
            <p>
              Status:{" "}
              <span className={`rounded px-2 py-0.5 text-xs ${badgeStyles[invoice.display_status.toLowerCase()] ?? ""}`}>
                {badgeLabel(invoice.display_status)}
              </span>
            </p>
            <p>Days overdue: {!paid && invoice.days_overdue > 0 ? invoice.days_overdue : "-"}</p>
            <p>
              <a href={invoice.pay_url} className="text-blue-700 hover:underline">Open customer pay link</a>
            </p>
          </div>

          {!paid && (
            <div className="mt-4 flex gap-2">
              <button type="button" className={btn} onClick={sendReminder}>Send next reminder</button>
              <button type="button" className={btn} onClick={markPaid}>Mark paid</button>
            </div>
          )}

          <h2 className="mt-6 text-lg font-semibold">Reminder history</h2>
          {invoice.reminders.length === 0 ? (
            <p className="mt-2 text-sm">No reminders sent yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {invoice.reminders.map((r) => (
                <li key={r.id} className="rounded border bg-white p-3 text-sm">
                  <div className="font-medium">{r.rule_name}</div>
                  <div>Trigger: {r.trigger}</div>
                  <div>Status: {r.status}</div>
                  <div>Subject: {r.subject}</div>
                  <div>Sent: {new Date(r.sent_at).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
