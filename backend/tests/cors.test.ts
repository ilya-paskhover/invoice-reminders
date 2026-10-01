import { afterAll, describe, expect, it } from "vitest";
import { makeApp, testPool } from "./helpers";

describe("CORS preflight", () => {
  afterAll(async () => {
    await testPool.end();
  });

  it("allows PUT on /api/rules/1 from the web origin", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/api/rules/1",
      headers: {
        origin: "http://localhost:13000",
        "access-control-request-method": "PUT",
      },
    });
    expect(res.statusCode).toBeLessThan(300);
    const methods = String(res.headers["access-control-allow-methods"]);
    expect(methods).toContain("PUT");
    await app.close();
  });
});
