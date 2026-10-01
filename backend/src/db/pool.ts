import pg from "pg";

// Keep `date` columns as "YYYY-MM-DD" strings (no timezone shift).
pg.types.setTypeParser(1082, (v: string) => v);

export function createPool(connectionString: string): pg.Pool {
  const pool = new pg.Pool({ connectionString });
  pool.on("error", (err) => {
    console.error("pg pool error:", err.message);
  });
  return pool;
}
