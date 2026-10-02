"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
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

function badgeStatus(s: string): "Open" | "Overdue" | "Paid" {
  const v = s.toLowerCase();
  return v === "paid" ? "Paid" : v === "overdue" ? "Overdue" : "Open";
}

const HEADS = ["Number", "Client", "Amount", "Due date", "Status", "Days overdue", "Reminders", "Last reminder", "Actions"];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
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
    } finally {
      setLoaded(true);
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

  const lbl = "block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        actions={
          <>
            <Button onClick={importMock}>Import from Stripe (mock)</Button>
            <Button variant="primary" onClick={() => setShowForm((v) => !v)}>New invoice</Button>
          </>
        }
      />

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <Card className="p-4 sm:p-6">
          {formError && <Alert tone="error" className="mb-4">{formError}</Alert>}
          <form onSubmit={createInvoice} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="inv-number" className={lbl}>Number</label>
              <Input id="inv-number" className="mt-1" value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-client-name" className={lbl}>Client name</label>
              <Input id="inv-client-name" className="mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-client-email" className={lbl}>Client email</label>
              <Input id="inv-client-email" className="mt-1" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-amount" className={lbl}>Amount</label>
              <Input id="inv-amount" className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="inv-due-date" className={lbl}>Due date</label>
              <Input id="inv-due-date" type="date" className="mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="primary" className="w-full sm:w-auto">Create invoice</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ["overdue", "Overdue"], ["paid", "Paid"]] as const).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "primary" : "secondary"}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            {HEADS.map((h) => (
              <Th key={h} className="!px-3">{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!loaded &&
            [0, 1, 2].map((i) => (
              <Tr key={`sk-${i}`}>
                <Td colSpan={HEADS.length}>
                  <Skeleton className="h-5 w-full" />
                </Td>
              </Tr>
            ))}
          {loaded && invoices.length === 0 && (
            <tr>
              <td colSpan={HEADS.length}>
                <EmptyState icon={<FileText className="h-5 w-5" />}>No invoices yet. Create one or import from Stripe (mock).</EmptyState>
              </td>
            </tr>
          )}
          {invoices.map((inv) => {
            const paid = inv.display_status.toLowerCase() === "paid";
            return (
              <Tr key={inv.id}>
                <Td className="!px-3">
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">{inv.number}</Link>
                </Td>
                <Td className="!px-3 !whitespace-normal">{inv.client_name}</Td>
                <Td className="!px-3">{formatMoney(inv.amount_cents, inv.currency)}</Td>
                <Td className="!px-3">{inv.due_date.slice(0, 10)}</Td>
                <Td className="!px-3">
                  <StatusBadge status={badgeStatus(inv.display_status)} />
                </Td>
                <Td className="!px-3">{!paid && inv.days_overdue > 0 ? inv.days_overdue : "-"}</Td>
                <Td className="!px-3">{inv.reminders_sent}</Td>
                <Td className="!px-3 !whitespace-normal">{inv.last_reminder ? inv.last_reminder.rule_name : "-"}</Td>
                <Td className="!px-3 !whitespace-normal">
                  {!paid && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="whitespace-nowrap" onClick={() => sendReminder(inv.id)}>Send next reminder</Button>
                      <Button size="sm" className="whitespace-nowrap" onClick={() => markPaid(inv.id)}>Mark paid</Button>
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
