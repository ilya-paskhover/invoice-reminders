import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

const valid = {
  name: "Extra",
  offset_days: 5,
  subject_template: "Hi {{ client_name }}",
  body_template: "Pay {{amount}} at {{pay_link}}",
};

describe("rules API", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPool.end();
  });

  it("lists seeded defaults ordered", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/rules" });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((r: any) => r.offset_days)).toEqual([1, 10, 30]);
    expect(res.json()[0].name).toBe("Friendly nudge");
  });

  it("creates a rule and orders it", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "POST", url: "/api/rules", payload: valid });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: "Extra", offset_days: 5, active: true });
    const list = await app.inject({ method: "GET", url: "/api/rules" });
    expect(list.json().map((r: any) => r.offset_days)).toEqual([1, 5, 10, 30]);
  });

  it("partially updates and toggles active", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "PUT",
      url: "/api/rules/1",
      payload: { subject_template: "New {{amount}}" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: 1,
      name: "Friendly nudge",
      subject_template: "New {{amount}}",
      active: true,
    });
    const off = await app.inject({ method: "PUT", url: "/api/rules/1", payload: { active: false } });
    expect(off.json().active).toBe(false);
    expect(off.json().subject_template).toBe("New {{amount}}");
  });

  it("rejects unknown placeholders", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/rules",
      payload: { ...valid, body_template: "{{nope}}" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("Unknown placeholder");
    expect(res.json().error).toContain("pay_link");
    const put = await app.inject({
      method: "PUT",
      url: "/api/rules/1",
      payload: { subject_template: "{{ x }}" },
    });
    expect(put.statusCode).toBe(400);
    expect(put.json().error).toContain("Unknown placeholder");
  });

  it("rejects bad offset and missing fields", async () => {
    const app = await makeApp();
    for (const offset_days of [0, 366, 1.5]) {
      const res = await app.inject({
        method: "POST",
        url: "/api/rules",
        payload: { ...valid, offset_days },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("Validation failed");
    }
    const res = await app.inject({ method: "PUT", url: "/api/rules/1", payload: { offset_days: 0 } });
    expect(res.statusCode).toBe(400);
    const missing = await app.inject({ method: "POST", url: "/api/rules", payload: {} });
    expect(missing.statusCode).toBe(400);
  });

  it("returns 404 for unknown rule", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "PUT", url: "/api/rules/9999", payload: { name: "x" } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Rule not found" });
  });
});
