import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import { makeApp, resetDb, testConfig, testPool } from "./helpers";
import { checkAndResetIfStale, resetDemoData } from "../src/demo/reset";
import { runDueReminders } from "../src/reminders/engine";
import { todayUtc } from "../src/dates";

const demoCfg = () => testConfig({ demoMode: true });

beforeAll(async () => {
  await resetDb();
});
beforeEach(async () => {
  await resetDb();
  await testPool.query("DELETE FROM demo_state");
});
afterAll(async () => {
  await testPool.end();
});

async function count(table: string): Promise<number> {
  const { rows } = await testPool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

describe("demo reset", () => {
  it("refuses when demo mode is off and keeps data", async () => {
    await testPool.query(
      "INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token) VALUES ('KEEP-1','A','a@x.test',100,current_date,'keeptoken')",
    );
    await expect(resetDemoData(testPool, testConfig())).rejects.toThrow(
      "Demo reset refused: DEMO_MODE is off",
    );
    expect(await count("invoices")).toBe(1);
  });

  it("seeds 9 invoices, 7 reminders, 3 rules and expected stats", async () => {
    const app = await makeApp({ demoMode: true });
    const res = await app.inject({ method: "POST", url: "/api/demo/reset" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.invoices).toBe(9);
    expect(body.reminders).toBe(7);
    expect(typeof body.reset_at).toBe("string");
    expect(await count("reminder_rules")).toBe(3);
    const stats = (await app.inject({ method: "GET", url: "/api/stats" })).json();
    expect(stats).toMatchObject({
      outstanding_cents: 1033000,
      overdue_count: 4,
      overdue_cents: 733000,
      reminders_sent: 7,
      paid_after_reminder_count: 2,
      paid_after_reminder_cents: 215000,
    });
    await app.close();
  });

  it("lets runDueReminders send exactly 3 reminders", async () => {
    await resetDemoData(testPool, demoCfg());
    const sent: string[] = [];
    const res = await runDueReminders(
      { pool: testPool, config: demoCfg(), emailSender: { async send(m: any) { sent.push(m.subject); } } },
      todayUtc(),
    );
    expect(res.sent).toBe(3);
    expect(res.results.map((r) => `${r.invoice_number}:${r.rule_name}`)).toEqual([
      "STR-1001:Friendly nudge",
      "STR-1002:Firm reminder",
      "STR-1003:Final notice",
    ]);
  });

  it("is idempotent", async () => {
    await resetDemoData(testPool, demoCfg());
    const second = await resetDemoData(testPool, demoCfg());
    expect(second.invoices).toBe(9);
    expect(second.reminders).toBe(7);
    expect(await count("invoices")).toBe(9);
    expect(await count("demo_state")).toBe(1);
  });
});

describe("checkAndResetIfStale", () => {
  it("never touches the pool when demo mode is off", async () => {
    const fake = { query: () => { throw new Error("must not be called"); }, connect: () => { throw new Error("must not be called"); } } as unknown as pg.Pool;
    expect(await checkAndResetIfStale(fake, testConfig())).toBe(false);
  });

  it("resets when there is no state or it is stale", async () => {
    expect(await checkAndResetIfStale(testPool, demoCfg())).toBe(true);
    expect(await count("invoices")).toBe(9);
    await testPool.query("UPDATE demo_state SET last_reset_on = current_date - 1");
    expect(await checkAndResetIfStale(testPool, demoCfg())).toBe(true);
  });

  it("does not reset when fresh", async () => {
    await resetDemoData(testPool, demoCfg());
    await testPool.query(
      "INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token) VALUES ('EXTRA-1','A','a@x.test',100,current_date,'extratoken')",
    );
    expect(await checkAndResetIfStale(testPool, demoCfg())).toBe(false);
    expect(await count("invoices")).toBe(10);
  });
});

describe("POST /api/demo/reset", () => {
  it("returns 404 when demo mode is off", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/demo/reset" });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
