import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MemoryEmailSender } from "../src/email/memory";
import { makeApp, resetDb, testPool } from "./helpers";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await testPool.end();
});

describe("GET /api/outbox", () => {
  it("lists a sent reminder with email details", async () => {
    const sender = new MemoryEmailSender();
    const app = await makeApp({}, sender);
    const inv = (
      await app.inject({
        method: "POST",
        url: "/api/invoices",
        payload: {
          number: "OB-1",
          client_name: "Acme",
          client_email: "acme@example.test",
          amount_cents: 5000,
          due_date: "2020-01-01",
        },
      })
    ).json();
    const sent = await app.inject({ method: "POST", url: `/api/invoices/${inv.id}/send-reminder` });
    expect(sent.statusCode).toBe(201);
    const res = await app.inject({ method: "GET", url: "/api/outbox?limit=5" });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list).toHaveLength(1);
    const e = list[0];
    expect(e.to_email).toBe("acme@example.test");
    expect(e.subject).toContain("OB-1");
    expect(e.body).toContain(e.pay_url);
    expect(e.pay_url).toMatch(/\/pay\/[0-9a-f]+$/);
    expect(e.pay_url.endsWith(`/pay/${inv.pay_url.split("/pay/")[1]}`)).toBe(true);
    expect(e.from_email).toContain("billing@demo-studio.test");
    expect(e.invoice_number).toBe("OB-1");
    expect(e.status).toBe("sent");
  });

  it("rejects out of range limits", async () => {
    const app = await makeApp();
    for (const l of ["0", "101", "abc"]) {
      expect((await app.inject({ method: "GET", url: `/api/outbox?limit=${l}` })).statusCode).toBe(400);
    }
  });
});
