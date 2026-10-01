import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

async function insert(over: Record<string, unknown> = {}) {
  const v = { number: "INV-1", client_name: "Ann", amount_cents: 30000, token: "tok-1", ...over };
  await testPool.query(
    "INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token) VALUES ($1,$2,'a@x.test',$3,current_date,$4)",
    [v.number, v.client_name, v.amount_cents, v.token],
  );
}

describe("pay link", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testPool.end();
  });

  it("shows checkout page", async () => {
    await insert();
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/pay/tok-1" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Pay invoice INV-1");
    expect(res.body).toContain("Ann");
    expect(res.body).toContain("Pay $300.00 (mock)");
    expect(res.body).toContain('action="/pay/tok-1"');
  });

  it("POST marks paid via pay_link and is idempotent", async () => {
    await insert();
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/pay/tok-1" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("Payment received. Thank you!");
    const a = (await testPool.query("SELECT status, paid_via, paid_at FROM invoices")).rows[0];
    expect(a.status).toBe("paid");
    expect(a.paid_via).toBe("pay_link");
    expect(a.paid_at).not.toBeNull();
    const res2 = await app.inject({ method: "POST", url: "/pay/tok-1" });
    expect(res2.body).toContain("Payment received. Thank you!");
    const b = (await testPool.query("SELECT paid_at FROM invoices")).rows[0];
    expect(b.paid_at).toEqual(a.paid_at);
    const get = await app.inject({ method: "GET", url: "/pay/tok-1" });
    expect(get.body).toContain("This invoice is already paid.");
    expect(get.body).not.toContain("(mock)");
  });

  it("404 for unknown token", async () => {
    const app = await makeApp();
    expect((await app.inject({ method: "GET", url: "/pay/nope" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/pay/nope" })).statusCode).toBe(404);
  });

  it("escapes HTML", async () => {
    await insert({ client_name: "<script>alert(1)</script>", number: "A&B" });
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/pay/tok-1" });
    expect(res.body).not.toContain("<script>alert");
    expect(res.body).toContain("&lt;script&gt;");
    expect(res.body).toContain("A&amp;B");
  });
});
