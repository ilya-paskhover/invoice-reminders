import pg from "pg";
import { runMigrations } from "../src/db/migrate";

const DEFAULT_URL = "postgres://postgres:postgres@127.0.0.1:15432/invoice_reminders_test";

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? DEFAULT_URL);
  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`Refusing to use non-test database ${dbName}`);

  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const adminPool = new pg.Pool({ connectionString: admin.toString() });
  adminPool.on("error", () => {});
  try {
    const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await adminPool.end();
  }

  const pool = new pg.Pool({ connectionString: url.toString() });
  pool.on("error", () => {});
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
