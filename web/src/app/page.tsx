"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, DollarSign, Info, Play, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

type Stats = {
  outstanding_cents: number;
  overdue_count: number;
  overdue_cents: number;
  reminders_sent: number;
  paid_after_reminder_count: number;
  paid_after_reminder_cents: number;
  currency: string;
};

type Reminder = {
  id: number;
  invoice_id: number;
  invoice_number: string;
  client_name: string;
  rule_name: string;
  trigger: string;
  status: string;
  subject?: string;
  sent_at: string;
};

type Scheduler = {
  enabled: boolean;
  interval_seconds: number;
  last_run_at: string | null;
  next_run_at: string | null;
};

type RunResult = { checked: number; sent: number; failed: number };

const noStore = { cache: "no-store" } as const;

function schedulerLine(s: Scheduler | null): string {
  if (!s) return "Scheduler: loading";
  if (!s.enabled) return "Scheduler: off";
  const every =
    s.interval_seconds % 60 === 0 ? `${s.interval_seconds / 60} min` : `${s.interval_seconds} s`;
  const next = s.next_run_at ? `, next run ${new Date(s.next_run_at).toLocaleTimeString()}` : "";
  return `Scheduler: every ${every}${next}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Reminder[]>([]);
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, rem, sch] = await Promise.all([
        apiFetch<Stats>("/api/stats", noStore),
        apiFetch<Reminder[]>("/api/reminders?limit=20", noStore),
        apiFetch<Scheduler>("/api/scheduler", noStore),
      ]);
      setStats(st);
      setActivity(rem);
      setScheduler(sch);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setError("");
    try {
      const r = await apiFetch<RunResult>("/api/reminders/run", { method: "POST", body: JSON.stringify({}) });
      setMessage(`Run complete: checked ${r.checked}, sent ${r.sent}, failed ${r.failed}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  const cur = stats?.currency ?? "USD";
  const loading = stats === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overdue invoices, reminders sent, and what they recovered."
        actions={
          <Button variant="primary" onClick={runNow} disabled={running}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Run reminders now
          </Button>
        }
      />
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          value={stats ? formatMoney(stats.outstanding_cents, cur) : "-"}
        />
        <StatCard
          label="Overdue invoices"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          value={stats ? stats.overdue_count : "-"}
          sub={stats ? formatMoney(stats.overdue_cents, cur) : ""}
        />
        <StatCard
          label="Reminders sent"
          icon={<Send className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          value={stats ? stats.reminders_sent : "-"}
        />
        <StatCard
          label="Recovered after reminder"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          loading={loading}
          value={stats ? stats.paid_after_reminder_count : "-"}
          sub={stats ? formatMoney(stats.paid_after_reminder_cents, cur) : ""}
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100/70 px-4 py-2.5 text-sm text-slate-600">
        <Info className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p>{schedulerLine(scheduler)}</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
        {activity.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <EmptyState>No activity yet.</EmptyState>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Client</Th>
                <Th>Rule</Th>
                <Th>Trigger</Th>
                <Th>Status</Th>
                <Th>Time</Th>
              </tr>
            </thead>
            <tbody>
              {activity.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link
                      href={`/invoices/${r.invoice_id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {r.invoice_number}
                    </Link>
                  </Td>
                  <Td>{r.client_name}</Td>
                  <Td>{r.rule_name}</Td>
                  <Td>
                    <Badge tone={r.trigger === "manual" ? "amber" : "indigo"}>{r.trigger}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={r.status === "sent" ? "emerald" : "rose"} dot>
                      {r.status}
                    </Badge>
                  </Td>
                  <Td className="tabular-nums text-slate-500">{new Date(r.sent_at).toLocaleString()}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
