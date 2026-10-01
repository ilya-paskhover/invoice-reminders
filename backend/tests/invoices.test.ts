import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const base = { number: "INV-1", client_name: "Ann", client_email: "ann@x.test", amount_cents: 30000 };

describe("invoices API", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPool.end();
  });

  async function create(body: object) {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/invoices", payload: body });
    return { app, res };
  }

  it("seeds default rules in resetDb", async () => {
    const { rows } = await testPool.query(
      "SELECT offset_days FROM reminder_rules ORDER BY offset_days",
    );
    expect(rows.map((r) => r.offset_days)).toEqual([1, 10, 30]);
  });

  it("creates an invoice with derived fields", async () => {
    const { res } = await create({ ...base, due_date: addDays(-5) });
    expect(res.statusCode).toBe(201);
    const inv = res.json();
    expect(inv.display_status).toBe("overdue");
    expect(inv.days_overdue).toBe(5);
    expect(inv.currency).toBe("USD");
    expect(inv.reminders_sent).toBe(0);
    expect(inv.last_reminder).toBeNull();
    expect(inv.pay_url).toMatch(/\/pay\/[0-9a-f]{32}$/);
    expect(inv.due_date).toBe(addDays(-5));
  });

  it("returns open for future or today due dates", async () => {
    const a = (await create({ ...base, due_date: addDays(3) })).res.json();
    const b = (await create({ ...base, due_date: addDays(0) })).res.json();
    expect(a.display_status).toBe("open");
    expect(a.days_overdue).toBe(0);
    expect(b.display_status).toBe("open");
  });

  it.each([
    ["empty number", { number: "" }],
    ["long number", { number: "x".repeat(51) }],
    ["empty client name", { client_name: "" }],
    ["bad email", { client_email: "nope" }],
    ["zero amount", { amount_cents: 0 }],
    ["fractional amount", { amount_cents: 10.5 }],
    ["bad currency", { currency: "US" }],
    ["bad due date", { due_date: "2025-13-45" }],
    ["bad issue date", { issue_date: "01/02/2025" }],
  ])("rejects %s with 400", async (_n, patch) => {
    const { res } = await create({ ...base, due_date: addDays(1), ...patch });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Validation failed");
    expect(Array.isArray(res.json().details)).toBe(true);
  });

  it("rejects missing due_date", async () => {
    const { res } = await create(base);
    expect(res.statusCode).toBe(400);
  });

  it("lists newest first and filters by status", async () => {
    const o = (await create({ ...base, number: "A", due_date: addDays(-2) })).res.json();
    const f = (await create({ ...base, number: "B", due_date: addDays(5) })).res.json();
    const p = (await create({ ...base, number: "C", due_date: addDays(-9) })).res.json();
    const app = await makeApp();
    await app.inject({ method: "POST", url: `/api/invoices/${p.id}/mark-paid` });
    const ids = async (q: string) =>
      (await app.inject({ method: "GET", url: `/api/invoices${q}` }))
        .json()
        .map((i: any) => i.id);
    expect(await ids("")).toEqual([p.id, f.id, o.id]);
    expect(await ids("?status=all")).toEqual([p.id, f.id, o.id]);
    expect(await ids("?status=overdue")).toEqual([o.id]);
    expect(await ids("?status=paid")).toEqual([p.id]);
    expect(await ids("?status=unpaid")).toEqual([f.id, o.id]);
    const bad = await app.inject({ method: "GET", url: "/api/invoices?status=zzz" });
    expect(bad.statusCode).toBe(400);
  });

  it("mark-paid is idempotent and paid invoices are not overdue", async () => {
    const inv = (await create({ ...base, due_date: addDays(-20) })).res.json();
    const app = await makeApp();
    const r1 = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/mark-paid` });
    expect(r1.statusCode).toBe(200);
    const p1 = r1.json();
    expect(p1.status).toBe("paid");
    expect(p1.paid_via).toBe("manual");
    expect(p1.display_status).toBe("paid");
    expect(p1.days_overdue).toBe(0);
    expect(p1.paid_at).toBeTruthy();
    const r2 = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/mark-paid` });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().paid_at).toBe(p1.paid_at);
  });

  it("gets one invoice with a reminders array, newest first", async () => {
    const inv = (await create({ ...base, due_date: addDays(-2) })).res.json();
    for (const [name, off] of [
      ["Friendly nudge", 1],
      ["Firm reminder", 10],
    ] as const) {
      await testPool.query(
        `INSERT INTO reminders (invoice_id, rule_name, rule_offset_days, trigger, to_email, subject, body, status)
         VALUES ($1,$2,$3,'manual','a@x.test','s','b','sent')`,
        [inv.id, name, off],
      );
    }
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: `/api/invoices/${inv.id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.reminders.map((r: any) => r.rule_name)).toEqual([
      "Firm reminder",
      "Friendly nudge",
    ]);
    expect(body.reminders[0].invoice_number).toBe("INV-1");
    expect(body.reminders_sent).toBe(2);
    expect(body.last_reminder.rule_name).toBe("Firm reminder");
  });

  it("returns 404 for unknown invoices", async () => {
    const app = await makeApp();
    for (const [m, u] of [
      ["GET", "/api/invoices/9999"],
      ["GET", "/api/invoices/abc"],
      ["POST", "/api/invoices/9999/mark-paid"],
    ] as const) {
      const res = await app.inject({ method: m, url: u });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Invoice not found" });
    }
  });
});
