import { beforeEach, describe, expect, it } from "vitest";
import { MemoryEmailSender } from "../src/email/memory";
import { Scheduler } from "../src/reminders/scheduler";
import { buildApp } from "../src/app";
import { resetDb, testConfig, testPool } from "./helpers";

beforeEach(resetDb);

describe("scheduler", () => {
  it("tick() sends due reminders and records last_run_at", async () => {
    const sender = new MemoryEmailSender();
    const config = testConfig({ schedulerIntervalSeconds: 3600 });
    const scheduler = new Scheduler({ pool: testPool, emailSender: sender, config });
    const app = await buildApp({ pool: testPool, emailSender: sender, config, scheduler });
    await testPool.query(
      `INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token)
       VALUES ('S-1','Acme','a@example.test',1000, current_date - 40, 'tok1')`,
    );

    const before = (await app.inject({ method: "GET", url: "/api/scheduler" })).json();
    expect(before).toMatchObject({ enabled: true, interval_seconds: 3600, last_run_at: null, last_result: null });

    await scheduler.tick();
    expect(sender.sent).toHaveLength(1);
    const after = (await app.inject({ method: "GET", url: "/api/scheduler" })).json();
    expect(after.last_run_at).toBeTruthy();
    expect(after.last_result).toEqual({ sent: 1, failed: 0 });

    await scheduler.tick();
    expect(sender.sent).toHaveLength(1);
  });

  it("interval 0 is disabled and start() schedules nothing", async () => {
    const sender = new MemoryEmailSender();
    const config = testConfig({ schedulerIntervalSeconds: 0 });
    const scheduler = new Scheduler({ pool: testPool, emailSender: sender, config });
    scheduler.start();
    const app = await buildApp({ pool: testPool, emailSender: sender, config, scheduler });
    const res = (await app.inject({ method: "GET", url: "/api/scheduler" })).json();
    expect(res).toMatchObject({ enabled: false, interval_seconds: 0, next_run_at: null });
    scheduler.stop();
  });

  it("buildApp alone does not start a timer (no next_run_at)", async () => {
    const config = testConfig({ schedulerIntervalSeconds: 3600 });
    const app = await buildApp({ pool: testPool, emailSender: new MemoryEmailSender(), config });
    const res = (await app.inject({ method: "GET", url: "/api/scheduler" })).json();
    expect(res.enabled).toBe(true);
    expect(res.next_run_at).toBeNull();
  });
});
