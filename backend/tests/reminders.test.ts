import { beforeEach, describe, expect, it } from "vitest";
import { MemoryEmailSender } from "../src/email/memory";
import { makeApp, resetDb, testPool } from "./helpers";

let sender: MemoryEmailSender;
let app: Awaited<ReturnType<typeof makeApp>>;

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const BASE = "2030-01-31";

async function mkInvoice(daysOverdue: number, number = "INV-1", amount = 125000) {
  const res = await app.inject({
    method: "POST",
    url: "/api/invoices",
    payload: {
      number,
      client_name: "Acme",
      client_email: "acme@example.test",
      amount_cents: amount,
      due_date: addDays(BASE, -daysOverdue),
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

async function run(asOf = BASE) {
  const res = await app.inject({ method: "POST", url: "/api/reminders/run", payload: { as_of: asOf } });
  expect(res.statusCode).toBe(200);
  return res.json();
}

beforeEach(async () => {
  await resetDb();
  sender = new MemoryEmailSender();
  app = await makeApp({}, sender);
});

describe("scheduled runs", () => {
  it("sends Firm reminder at 12 days overdue", async () => {
    await mkInvoice(12);
    const r = await run();
    expect(r).toMatchObject({ as_of: BASE, checked: 1, sent: 1, failed: 0 });
    expect(r.results[0]).toMatchObject({ rule_name: "Firm reminder", status: "sent" });
  });

  it("sends Final notice at 35 days overdue", async () => {
    await mkInvoice(35);
    const r = await run();
    expect(r.results[0].rule_name).toBe("Final notice");
  });

  it("second run on same date sends nothing; later date escalates", async () => {
    await mkInvoice(12);
    expect((await run()).sent).toBe(1);
    expect((await run()).sent).toBe(0);
    const later = await run(addDays(BASE, 20));
    expect(later.sent).toBe(1);
    expect(later.results[0].rule_name).toBe("Final notice");
    expect(sender.sent).toHaveLength(2);
  });

  it("skips paid and not-yet-due invoices", async () => {
    const paid = await mkInvoice(12, "P");
    await app.inject({ method: "POST", url: `/api/invoices/${paid.id}/mark-paid` });
    await mkInvoice(0, "DUE-TODAY");
    await mkInvoice(-5, "FUTURE");
    const r = await run();
    expect(r.sent).toBe(0);
    expect(sender.sent).toHaveLength(0);
  });

  it("ignores inactive rules", async () => {
    await testPool.query("UPDATE reminder_rules SET active = false WHERE offset_days = 10");
    await mkInvoice(12);
    const r = await run();
    expect(r.results[0].rule_name).toBe("Friendly nudge");
  });

  it("logs failed sends and retries on the next run", async () => {
    await mkInvoice(12);
    sender.setFailing(true);
    const r1 = await run();
    expect(r1).toMatchObject({ sent: 0, failed: 1 });
    expect(r1.results[0].status).toBe("failed");
    const list = (await app.inject({ method: "GET", url: "/api/reminders" })).json();
    expect(list[0]).toMatchObject({ status: "failed", trigger: "scheduled" });
    expect(list[0].error).toBeTruthy();
    const inv = (await app.inject({ method: "GET", url: "/api/invoices" })).json()[0];
    expect(inv.reminders_sent).toBe(0);
    expect(inv.last_reminder).toBeNull();
    sender.setFailing(false);
    const r2 = await run();
    expect(r2).toMatchObject({ sent: 1, failed: 0 });
  });

  it("renders subject and body with invoice number, amount and pay link", async () => {
    const inv = await mkInvoice(12, "INV-777", 125000);
    await run();
    const m = sender.sent[0]!;
    expect(m.to).toBe("acme@example.test");
    expect(m.subject).toContain("INV-777");
    expect(m.text).toContain("$1,250.00");
    expect(m.text).toContain(inv.pay_url);
    const list = (await app.inject({ method: "GET", url: "/api/reminders" })).json();
    expect(list[0].subject).toBe(m.subject);
    expect(list[0].invoice_number).toBe("INV-777");
  });
});

describe("manual send", () => {
  it("walks 1 -> 10 -> 30 -> repeats 30 and updates invoice fields", async () => {
    const inv = await mkInvoice(2);
    const names: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.reminder.trigger).toBe("manual");
      names.push(body.reminder.rule_name);
    }
    expect(names).toEqual(["Friendly nudge", "Firm reminder", "Final notice", "Final notice"]);
    const detail = (await app.inject({ method: "GET", url: `/api/invoices/${inv.id}` })).json();
    expect(detail.reminders_sent).toBe(4);
    expect(detail.reminders).toHaveLength(4);
    expect(detail.last_reminder.rule_name).toBe("Final notice");
  });

  it("409 when paid, 409 with no active rules, 404 unknown, 502 on failure", async () => {
    const inv = await mkInvoice(2);
    sender.setFailing(true);
    const bad = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    expect(bad.statusCode).toBe(502);
    expect(bad.json().error).toBe("Email delivery failed");
    expect(bad.json().reminder.status).toBe("failed");
    sender.setFailing(false);

    await testPool.query("UPDATE reminder_rules SET active = false");
    const none = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    expect(none.statusCode).toBe(409);
    await testPool.query("UPDATE reminder_rules SET active = true");

    await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/mark-paid` });
    const paid = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    expect(paid.statusCode).toBe(409);

    const nf = await app.inject({ method: "POST", url: "/api/invoices/99999/send-reminder" });
    expect(nf.statusCode).toBe(404);
  });

  it("is allowed before the due date", async () => {
    const inv = await mkInvoice(-10);
    const res = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /api/reminders", () => {
  it("is newest first and validates limit", async () => {
    const inv = await mkInvoice(2);
    for (let i = 0; i < 3; i++) await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    const two = (await app.inject({ method: "GET", url: "/api/reminders?limit=2" })).json();
    expect(two).toHaveLength(2);
    expect(two[0].id).toBeGreaterThan(two[1].id);
    expect((await app.inject({ method: "GET", url: "/api/reminders?limit=0" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/reminders?limit=101" })).statusCode).toBe(400);
  });
});
