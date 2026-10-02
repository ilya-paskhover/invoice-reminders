import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailSender } from "../src/email";
import { DemoEmailSender } from "../src/email/demo";
import { MemoryEmailSender } from "../src/email/memory";
import { makeApp, resetDb, testConfig, testPool } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await testPool.query("DELETE FROM demo_state");
});
afterAll(async () => {
  await testPool.end();
});

describe("email suppression", () => {
  it("demo mode returns DemoEmailSender whatever the provider", async () => {
    expect(createEmailSender(testConfig({ demoMode: true, emailProvider: "smtp" }))).toBeInstanceOf(
      DemoEmailSender,
    );
    expect(createEmailSender(testConfig({ demoMode: true, emailProvider: "memory" }))).toBeInstanceOf(
      DemoEmailSender,
    );
    expect(createEmailSender(testConfig({ emailProvider: "memory" }))).toBeInstanceOf(MemoryEmailSender);
  });

  it("demo sender logs one line and keeps nothing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const s = new DemoEmailSender();
    await s.send({ to: "a@x.test", from: "f@x.test", subject: "Hi", text: "body" });
    expect(spy).toHaveBeenCalledWith("demo mode: email to a@x.test suppressed: Hi");
    expect(Object.keys(s)).toEqual([]);
    spy.mockRestore();
  });
});

describe("GET /api/meta", () => {
  it("normal mode", async () => {
    const app = await makeApp({ emailProvider: "memory" });
    const res = await app.inject({ method: "GET", url: "/api/meta" });
    expect(res.json()).toEqual({
      demo_mode: false,
      email_delivery: "memory",
      last_reset_at: null,
      next_reset_at: null,
    });
  });

  it("demo mode", async () => {
    const app = await makeApp({ demoMode: true, emailProvider: "smtp" });
    expect((await app.inject({ method: "POST", url: "/api/demo/reset" })).statusCode).toBe(200);
    const body = (await app.inject({ method: "GET", url: "/api/meta" })).json();
    expect(body.demo_mode).toBe(true);
    expect(body.email_delivery).toBe("suppressed");
    expect(typeof body.last_reset_at).toBe("string");
    expect(new Date(body.next_reset_at).toISOString()).toMatch(/T00:00:00\.000Z$/);
    expect(new Date(body.next_reset_at).getTime()).toBeGreaterThan(Date.now());
  });
});
