import pg from "pg";

/** Creates the database named in `url` if it does not exist (connects to the `postgres` database first). */
export async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  if (!dbName) throw new Error("DATABASE_URL has no database name");
  const admin = new URL(target.toString());
  admin.pathname = "/postgres";
  const adminPool = new pg.Pool({ connectionString: admin.toString() });
  adminPool.on("error", () => {});
  try {
    const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) await adminPool.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
  } finally {
    await adminPool.end();
  }
}
