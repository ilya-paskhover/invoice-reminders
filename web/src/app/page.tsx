"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
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

  const card = "rounded border bg-white p-4";
  const label = "text-sm text-gray-600";
  const big = "mt-1 text-3xl font-semibold";
  const cur = stats?.currency ?? "USD";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          type="button"
          className="rounded border bg-white px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
          onClick={runNow}
          disabled={running}
        >
          Run reminders now
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid grid-cols-4 gap-4">
        <div className={card}>
          <div className={label}>Outstanding</div>
          <div className={big}>{stats ? formatMoney(stats.outstanding_cents, cur) : "-"}</div>
        </div>
        <div className={card}>
          <div className={label}>Overdue invoices</div>
          <div className={big}>{stats ? stats.overdue_count : "-"}</div>
          <div className="text-sm text-gray-600">{stats ? formatMoney(stats.overdue_cents, cur) : ""}</div>
        </div>
        <div className={card}>
          <div className={label}>Reminders sent</div>
          <div className={big}>{stats ? stats.reminders_sent : "-"}</div>
        </div>
        <div className={card}>
          <div className={label}>Recovered after reminder</div>
          <div className={big}>{stats ? stats.paid_after_reminder_count : "-"}</div>
          <div className="text-sm text-gray-600">
            {stats ? formatMoney(stats.paid_after_reminder_cents, cur) : ""}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-700">{schedulerLine(scheduler)}</p>

      <h2 className="mt-6 text-lg font-semibold">Recent activity</h2>
      {activity.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No activity yet.</p>
      ) : (
        <table className="mt-2 w-full border bg-white text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-2">Invoice</th>
              <th className="p-2">Client</th>
              <th className="p-2">Rule</th>
              <th className="p-2">Trigger</th>
              <th className="p-2">Status</th>
              <th className="p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.invoice_number}</td>
                <td className="p-2">{r.client_name}</td>
                <td className="p-2">{r.rule_name}</td>
                <td className="p-2">{r.trigger}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{new Date(r.sent_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
