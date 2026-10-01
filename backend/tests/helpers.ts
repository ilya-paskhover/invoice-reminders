import type { FastifyInstance } from "fastify";
import { createPool } from "../src/db/pool";
import { buildApp } from "../src/app";
import { loadConfig, type Config } from "../src/config";
import type { EmailSender } from "../src/email/types";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:15432/invoice_reminders_test";

export const testPool = createPool(TEST_DATABASE_URL);

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...loadConfig({}),
    databaseUrl: TEST_DATABASE_URL,
    emailProvider: "memory",
    schedulerIntervalSeconds: 0,
    ...overrides,
  };
}

// Later tasks add the default-rule re-seed once the tables and seed function exist.
export async function resetDb(): Promise<void> {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to reset non-test database ${dbName}`);
  const t = await testPool.query(
    "SELECT to_regclass('public.reminders') AS r, to_regclass('public.invoices') AS i, to_regclass('public.reminder_rules') AS rr",
  );
  const row = t.rows[0];
  if (row.r && row.i && row.rr) {
    await testPool.query("TRUNCATE reminders, invoices, reminder_rules RESTART IDENTITY CASCADE");
  }
}

export async function makeApp(
  overrides: Partial<Config> = {},
  emailSender?: EmailSender,
): Promise<FastifyInstance> {
  const sender: EmailSender = emailSender ?? { async send() {} };
  return buildApp({ pool: testPool, emailSender: sender, config: testConfig(overrides) });
}
