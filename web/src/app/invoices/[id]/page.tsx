"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
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

function badgeStatus(s: string): "Open" | "Overdue" | "Paid" {
  const v = s.toLowerCase();
  return v === "paid" ? "Paid" : v === "overdue" ? "Overdue" : "Open";
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loaded, setLoaded] = useState(false);
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
    } finally {
      setLoaded(true);
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

  const paid = invoice?.display_status.toLowerCase() === "paid";
  const dt = "text-xs font-medium text-slate-500";
  const dd = "mt-1 break-words text-sm text-slate-900";

  return (
    <div className="space-y-6">
      <Link href="/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to invoices
      </Link>

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {notFound && (
        <Card>
          <EmptyState icon={<Inbox className="h-5 w-5" />}>Invoice not found</EmptyState>
        </Card>
      )}

      {!loaded && !invoice && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {invoice && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900">Invoice {invoice.number}</h1>
            {!paid && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={sendReminder}>Send next reminder</Button>
                <Button onClick={markPaid}>Mark paid</Button>
              </div>
            )}
          </div>

          <Card className="p-4 sm:p-6">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className={dt}>Client</dt>
                <dd className={dd}>{invoice.client_name} ({invoice.client_email})</dd>
              </div>
              <div>
                <dt className={dt}>Amount</dt>
                <dd className={dd}>{formatMoney(invoice.amount_cents, invoice.currency)}</dd>
              </div>
              <div>
                <dt className={dt}>Due date</dt>
                <dd className={dd}>{invoice.due_date.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className={dt}>Status</dt>
                <dd className={dd}><StatusBadge status={badgeStatus(invoice.display_status)} /></dd>
              </div>
              <div>
                <dt className={dt}>Days overdue</dt>
                <dd className={dd}>{!paid && invoice.days_overdue > 0 ? invoice.days_overdue : "-"}</dd>
              </div>
              <div>
                <dt className={dt}>Pay link</dt>
                <dd className={dd}>
                  <a href={invoice.pay_url} className="font-medium text-indigo-600 hover:underline">Open customer pay link</a>
                </dd>
              </div>
            </dl>
          </Card>

          <h2 className="text-lg font-semibold text-slate-900">Reminder history</h2>
          {invoice.reminders.length === 0 ? (
            <Card>
              <EmptyState icon={<Inbox className="h-5 w-5" />}>No reminders sent yet.</EmptyState>
            </Card>
          ) : (
            <ul className="space-y-3">
              {invoice.reminders.map((r) => (
                <li key={r.id}>
                  <Card className="p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{r.rule_name}</span>
                      <Badge tone={r.trigger === "manual" ? "amber" : "indigo"}>{r.trigger}</Badge>
                      <Badge tone={r.status === "sent" ? "emerald" : "rose"} dot>{r.status}</Badge>
                    </div>
                    <div className="mt-2 break-words text-slate-700">{r.subject}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(r.sent_at).toLocaleString()}</div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
