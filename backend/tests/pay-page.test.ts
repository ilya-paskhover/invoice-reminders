import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

async function insert() {
  await testPool.query(
    "INSERT INTO invoices (number, client_name, client_email, amount_cents, due_date, pay_token) VALUES ('INV-9','Ann','a@x.test',12000,'2026-01-15','tok-9')",
  );
}

function expectShell(body: string) {
  expect(body).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
  expect(body).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  expect(body).toContain("<style>");
  expect(body).not.toContain("<script");
}

describe("pay page shell", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await testPool.end();
  });

  it("checkout page uses the shell and shows details", async () => {
    await insert();
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/pay/tok-9" });
    expectShell(res.body);
    expect(res.body).toContain("Demo Studio");
    expect(res.body).toContain("Pay invoice INV-9");
    expect(res.body).toContain("Due 2026-01-15");
    expect(res.body).toContain("Pay $120.00 (mock)");
    expect(res.body).toContain("Mock checkout. No real payment is taken.");
  });

  it("success and already-paid pages use the shell", async () => {
    await insert();
    const app = await makeApp();
    const ok = await app.inject({ method: "POST", url: "/pay/tok-9" });
    expectShell(ok.body);
    expect(ok.body).toContain("Payment received. Thank you!");
    expect(ok.body).toContain("<svg");
    const paid = await app.inject({ method: "GET", url: "/pay/tok-9" });
    expectShell(paid.body);
    expect(paid.body).toContain("This invoice is already paid.");
    expect(paid.body).not.toContain("(mock)");
  });

  it("404 page uses the shell", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/pay/nope" });
    expect(res.statusCode).toBe(404);
    expectShell(res.body);
    expect(res.body).toContain("Payment link not found");
  });

  it("serves favicons", async () => {
    const app = await makeApp();
    for (const url of ["/favicon.svg", "/favicon.ico"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("image/svg+xml");
      expect(res.body).toContain("<svg");
    }
  });
});
