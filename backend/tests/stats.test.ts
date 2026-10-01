import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

async function inv(n: string, cents: number, dueOffset: number, paidAt: string | null) {
  const { rows } = await testPool.query(
    `INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token, status, paid_at, paid_via)
     VALUES ($1,'C','c@x.test',$2,(now() at time zone 'utc')::date + $3::int,$1,$4,$5::timestamptz,$6) RETURNING id`,
    [n, cents, dueOffset, paidAt ? "paid" : "unpaid", paidAt, paidAt ? "manual" : null],
  );
  return rows[0].id as number;
}
async function rem(id: number, sentAt: string, status = "sent") {
  await testPool.query(
    `INSERT INTO reminders (invoice_id, rule_name, rule_offset_days, trigger, to_email, subject, body, status, sent_at)
     VALUES ($1,'R',1,'scheduled','c@x.test','s','b',$2,$3::timestamptz)`,
    [id, status, sentAt],
  );
}

describe("stats", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testPool.end();
  });

  it("empty db gives zeros", async () => {
    const app = await makeApp();
    const s = (await app.inject({ method: "GET", url: "/api/stats" })).json();
    expect(s).toEqual({
      outstanding_cents: 0,
      overdue_count: 0,
      overdue_cents: 0,
      reminders_sent: 0,
      paid_after_reminder_count: 0,
      paid_after_reminder_cents: 0,
      currency: "USD",
    });
  });

  it("sums and counts, only reminders before payment count", async () => {
    const a = await inv("A", 10000, -5, null);
    await inv("B", 20000, 5, null);
    const c = await inv("C", 30000, -9, "2026-01-10T00:00:00Z");
    const d = await inv("D", 40000, -9, "2026-01-10T00:00:00Z");
    await inv("E", 50000, -9, "2026-01-10T00:00:00Z");
    const f = await inv("F", 60000, -9, "2026-01-10T00:00:00Z");
    await rem(a, "2026-01-01T00:00:00Z");
    await rem(c, "2026-01-05T00:00:00Z");
    await rem(d, "2026-01-11T00:00:00Z");
    await rem(f, "2026-01-05T00:00:00Z", "failed");
    const app = await makeApp();
    const s = (await app.inject({ method: "GET", url: "/api/stats" })).json();
    expect(s.outstanding_cents).toBe(30000);
    expect(s.overdue_count).toBe(1);
    expect(s.overdue_cents).toBe(10000);
    expect(s.reminders_sent).toBe(3);
    expect(s.paid_after_reminder_count).toBe(1);
    expect(s.paid_after_reminder_cents).toBe(30000);
    expect(s.currency).toBe("USD");
  });
});
