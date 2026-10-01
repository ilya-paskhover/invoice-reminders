import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeApp, resetDb, testPool } from "./helpers";

describe("POST /api/import/mock-stripe", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await testPool.end();
  });

  it("imports 4 then skips 4, with three overdue", async () => {
    const app = await makeApp();
    const r1 = await app.inject({ method: "POST", url: "/api/import/mock-stripe" });
    expect(r1.statusCode).toBe(200);
    expect(r1.json()).toEqual({ imported: 4, skipped: 0 });
    const r2 = await app.inject({ method: "POST", url: "/api/import/mock-stripe" });
    expect(r2.json()).toEqual({ imported: 0, skipped: 4 });

    const list = (await app.inject({ method: "GET", url: "/api/invoices" })).json();
    expect(list).toHaveLength(4);
    expect(list.filter((i: any) => i.display_status === "overdue")).toHaveLength(3);
    const byNum = Object.fromEntries(list.map((i: any) => [i.number, i]));
    expect(byNum["STR-1001"].days_overdue).toBe(3);
    expect(byNum["STR-1002"].days_overdue).toBe(12);
    expect(byNum["STR-1003"].days_overdue).toBe(35);
    expect(byNum["STR-1004"].display_status).toBe("open");
    expect(byNum["STR-1003"].source).toBe("mock_stripe");
    expect(byNum["STR-1003"].external_id).toBe("mock_in_1003");
    expect(byNum["STR-1003"].amount_cents).toBe(240000);
  });
});
