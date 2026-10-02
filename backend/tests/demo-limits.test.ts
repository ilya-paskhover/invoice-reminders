import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await testPool.end();
});

const inv = (n: number, extra: Record<string, unknown> = {}) => ({
  method: "POST" as const,
  url: "/api/invoices",
  payload: {
    number: `L-${n}`,
    client_name: "Acme",
    client_email: "acme@example.test",
    amount_cents: 100,
    due_date: "2030-01-01",
    ...extra,
  },
});

describe("demo write rate limit", () => {
  it("returns 429 after the limit; GETs are never limited", async () => {
    const app = await makeApp({ demoMode: true, demoWriteRateLimit: 3 });
    for (let i = 1; i <= 3; i++) expect((await app.inject(inv(i))).statusCode).toBe(201);
    const res = await app.inject(inv(4));
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toContain("Too many requests");
    for (let i = 0; i < 10; i++) {
      expect((await app.inject({ method: "GET", url: "/api/invoices" })).statusCode).toBe(200);
    }
  });

  it("is off outside demo mode", async () => {
    const app = await makeApp({ demoWriteRateLimit: 3 });
    for (let i = 1; i <= 10; i++) expect((await app.inject(inv(i))).statusCode).toBe(201);
  });
});

describe("demo caps", () => {
  it("caps invoices", async () => {
    const app = await makeApp({ demoMode: true, demoMaxInvoices: 2 });
    expect((await app.inject(inv(1))).statusCode).toBe(201);
    expect((await app.inject(inv(2))).statusCode).toBe(201);
    const res = await app.inject(inv(3));
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Demo limit reached: at most 2 invoices");
  });

  it("caps rules", async () => {
    const app = await makeApp({ demoMode: true, demoMaxRules: 3 });
    const res = await app.inject({
      method: "POST",
      url: "/api/rules",
      payload: { name: "X", offset_days: 5, subject_template: "s", body_template: "b" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toContain("Demo limit reached: at most 3 rules");
  });

  it("returns 413 for a 100 KB body in demo mode", async () => {
    const app = await makeApp({ demoMode: true });
    const res = await app.inject(inv(1, { client_name: "x".repeat(100_000) }));
    expect(res.statusCode).toBe(413);
  });

  it("rejects client_email over 254 chars in both modes", async () => {
    const app = await makeApp();
    const res = await app.inject(inv(1, { client_email: `${"a".repeat(250)}@example.test` }));
    expect(res.statusCode).toBe(400);
  });
});
