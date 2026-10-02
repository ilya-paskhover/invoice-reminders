import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(process.cwd(), "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const render = parse(read("render.yaml"));
const [api, web] = render.services;
const env = (svc: any, key: string) => svc.envVars.find((e: any) => e.key === key);

describe("render.yaml", () => {
  it("declares two docker web services with existing files", () => {
    expect(render.services).toHaveLength(2);
    for (const s of render.services) {
      expect(s.type).toBe("web");
      expect(s.runtime).toBe("docker");
      expect(existsSync(path.join(root, s.dockerfilePath))).toBe(true);
      expect(existsSync(path.join(root, s.dockerContext))).toBe(true);
    }
  });

  it("has the health check paths", () => {
    expect(api.healthCheckPath).toBe("/api/health");
    expect(web.healthCheckPath).toBe("/");
  });

  it("runs the API as a single instance without scaling", () => {
    expect(api.numInstances).toBe(1);
    expect(api.scaling).toBeUndefined();
  });

  it("wires DATABASE_URL from the managed database", () => {
    expect(env(api, "DATABASE_URL").fromDatabase).toEqual({
      name: render.databases[0].name,
      property: "connectionString",
    });
    expect(env(api, "DATABASE_SSL").value).toBe("true");
  });

  it("enables demo mode and safe settings", () => {
    expect(env(api, "DEMO_MODE").value).toBe("true");
    expect(env(web, "DEMO_MODE").value).toBe("true");
    expect(env(api, "EMAIL_PROVIDER").value).toBe("memory");
    expect(env(api, "TRUST_PROXY").value).toBe("true");
  });

  it("prompts for the URL variables", () => {
    for (const k of ["PUBLIC_API_URL", "WEB_ORIGIN"]) expect(env(api, k).sync).toBe(false);
    expect(env(web, "NEXT_PUBLIC_API_URL").sync).toBe(false);
  });

  it("documents every env var in deployment.md and .env.example", () => {
    const doc = read("docs/deployment.md");
    const example = read(".env.example");
    for (const s of render.services) {
      for (const e of s.envVars) {
        expect(doc, `deployment.md mentions ${e.key}`).toContain(e.key);
        expect(example, `.env.example mentions ${e.key}`).toMatch(new RegExp(`^${e.key}=`, "m"));
      }
    }
  });
});

describe("docker-compose.demo.yml", () => {
  it("uses the demo database in demo mode", () => {
    const demo = parse(read("docker-compose.demo.yml"));
    expect(demo.services.api.environment.DEMO_MODE).toBe("true");
    expect(demo.services.api.environment.DATABASE_URL.endsWith("/invoice_reminders_demo")).toBe(true);
  });
});
