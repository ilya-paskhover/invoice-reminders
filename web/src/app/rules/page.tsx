"use client";

import { ListChecks } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

type Rule = {
  id: number;
  name: string;
  offset_days: number;
  subject_template: string;
  body_template: string;
  active: boolean;
};

const PLACEHOLDERS = [
  "client_name",
  "invoice_number",
  "amount",
  "due_date",
  "days_overdue",
  "business_name",
  "pay_link",
];

const HEADS = ["Name", "Days after due", "Subject", "Status", "Actions"];

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      setRules(await apiFetch<Rule[]>("/api/rules"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditingId(null);
    setName("");
    setDays("");
    setSubject("");
    setBody("");
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(r: Rule) {
    setEditingId(r.id);
    setName(r.name);
    setDays(String(r.offset_days));
    setSubject(r.subject_template);
    setBody(r.body_template);
    setFormError("");
    setFormOpen(true);
  }

  function cancel() {
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const offset = Number(days);
    if (days.trim() === "" || !Number.isInteger(offset) || offset < 0) {
      setFormError("Days after due must be a whole number, 0 or more");
      return;
    }
    const payload = {
      name: name.trim(),
      offset_days: offset,
      subject_template: subject,
      body_template: body,
    };
    try {
      if (editingId === null) {
        await apiFetch<Rule>("/api/rules", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await apiFetch<Rule>(`/api/rules/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      setFormOpen(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggle(r: Rule) {
    setError("");
    try {
      await apiFetch<Rule>(`/api/rules/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !r.active }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const lbl = "block text-sm font-medium text-slate-700";

  return (
    <div className="space-y-6">
      <PageHeader title="Reminder rules" actions={<Button variant="primary" onClick={openAdd}>Add rule</Button>} />

      {error && <Alert tone="error">{error}</Alert>}

      {formOpen && (
        <Card className="p-4 sm:p-6">
          {formError && <Alert tone="error" className="mb-4">{formError}</Alert>}
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <label htmlFor="rule-name" className={lbl}>Name</label>
              <Input id="rule-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-days" className={lbl}>Days after due</label>
              <Input id="rule-days" type="number" min={0} className="mt-1" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-subject" className={lbl}>Subject</label>
              <Input id="rule-subject" className="mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-body" className={lbl}>Body</label>
              <Textarea id="rule-body" rows={6} className="mt-1" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <p className="break-words text-xs text-slate-500">
              Allowed placeholders: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary">{editingId === null ? "Create rule" : "Save"}</Button>
              <Button onClick={cancel}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Table>
        <thead>
          <tr>
            {HEADS.map((h) => (
              <Th key={h}>{h}</Th>
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
          {loaded && rules.length === 0 && (
            <tr>
              <td colSpan={HEADS.length}>
                <EmptyState icon={<ListChecks className="h-5 w-5" />}>No reminder rules yet. Add one to get started.</EmptyState>
              </td>
            </tr>
          )}
          {rules.map((r) => (
            <Tr key={r.id}>
              <Td className="font-medium text-slate-900">{r.name}</Td>
              <Td>{r.offset_days} days</Td>
              <Td className="min-w-[16rem] whitespace-normal break-words">{r.subject_template}</Td>
              <Td>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Badge tone={r.active ? "emerald" : "slate"} dot>{r.active ? "Active" : "Inactive"}</Badge>
                </button>
              </Td>
              <Td>
                <Button size="sm" onClick={() => openEdit(r)}>Edit</Button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
