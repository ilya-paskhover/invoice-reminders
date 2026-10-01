"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
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

  const input = "mt-1 block w-full rounded border px-2 py-1";
  const btn = "rounded border bg-white px-3 py-1 text-sm hover:bg-gray-100";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reminder rules</h1>
        <button type="button" className={btn} onClick={openAdd}>Add rule</button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {formOpen && (
        <div className="mt-4 rounded border bg-white p-4">
          {formError && <p className="mb-3 text-sm text-red-700">{formError}</p>}
          <form onSubmit={submit} className="grid gap-4">
            <div>
              <label htmlFor="rule-name">Name</label>
              <input id="rule-name" className={input} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-days">Days after due</label>
              <input id="rule-days" type="number" min={0} className={input} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-subject">Subject</label>
              <input id="rule-subject" className={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rule-body">Body</label>
              <textarea id="rule-body" rows={6} className={input} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <p className="text-xs text-gray-600">
              Allowed placeholders: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}
            </p>
            <div className="flex gap-2">
              <button type="submit" className={btn}>{editingId === null ? "Create rule" : "Save"}</button>
              <button type="button" className={btn} onClick={cancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table className="mt-6 w-full border bg-white text-left text-sm">
        <thead className="border-b bg-gray-100">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Days after due</th>
            <th className="p-2">Subject</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.offset_days} days</td>
              <td className="p-2">{r.subject_template}</td>
              <td className="p-2">
                <button type="button" className={btn} onClick={() => toggle(r)}>{r.active ? "Active" : "Inactive"}</button>
              </td>
              <td className="p-2">
                <button type="button" className={btn} onClick={() => openEdit(r)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
