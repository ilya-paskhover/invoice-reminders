import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

describe("GET /api/health", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPool.end();
  });

  it("returns ok with a working database", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "ok" });
    await app.close();
  });
});
