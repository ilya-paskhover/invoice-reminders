"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type Email = {
  id: number;
  invoice_id: number;
  invoice_number: string;
  client_name: string;
  rule_name: string | null;
  trigger: string;
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  pay_url: string;
  status: string;
  error: string | null;
  sent_at: string;
};

export default function OutboxPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Email[]>("/api/outbox?limit=50")
      .then(setEmails)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load outbox"))
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Outbox" description="Reminder emails sent by the app, newest first." />
      {error && <Alert tone="error">{error}</Alert>}
      {!loaded &&
        [0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3 p-4 sm:p-6">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </Card>
        ))}
      {loaded && !error && emails.length === 0 && (
        <Card>
          <EmptyState icon={<Mail className="h-5 w-5" />}>No emails sent yet.</EmptyState>
        </Card>
      )}
      {emails.map((m) => (
        <Card key={m.id} className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="break-words text-base font-semibold text-slate-900">{m.subject}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="indigo">{m.trigger}</Badge>
              <Badge tone={m.status === "sent" ? "emerald" : "rose"} dot>{m.status}</Badge>
            </div>
          </div>
          <div className="space-y-0.5 break-words text-sm text-slate-600">
            <p>To: {m.to_email}</p>
            <p>From: {m.from_email}</p>
            <p>
              Sent {new Date(m.sent_at).toLocaleString()}
              {m.rule_name ? ` · Rule: ${m.rule_name}` : ""} · Invoice{" "}
              <Link href={`/invoices/${m.invoice_id}`} className="font-medium text-indigo-600 hover:underline">
                {m.invoice_number}
              </Link>
            </p>
            {m.error && <p className="text-rose-700">Error: {m.error}</p>}
          </div>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm text-slate-800">{m.body}</pre>
          <a href={m.pay_url} className="inline-block text-sm font-medium text-indigo-600 hover:underline">
            Open pay link
          </a>
        </Card>
      ))}
    </div>
  );
}
