import { loadConfig } from "./config";
import { createPool } from "./db/pool";
import { runMigrations } from "./db/migrate";
import { seedDefaultRules } from "./db/seed";
import { buildApp } from "./app";
import { createEmailSender } from "./email";
import { ensureDatabase } from "./db/ensure-database";
import { checkAndResetIfStale } from "./demo/reset";
import { DemoResetter } from "./demo/resetter";
import { Scheduler } from "./reminders/scheduler";

async function main() {
  const config = loadConfig();
  if (config.dbCreateIfMissing) await ensureDatabase(config.databaseUrl, config.databaseSsl);
  const pool = createPool(config.databaseUrl, config.databaseSsl);
  await runMigrations(pool);
  await seedDefaultRules(pool);
  if (config.demoMode) await checkAndResetIfStale(pool, config);
  const emailSender = createEmailSender(config);
  const scheduler = new Scheduler({ pool, emailSender, config });
  const app = await buildApp({ pool, emailSender, config, scheduler });
  await app.listen({ host: "0.0.0.0", port: config.port });
  scheduler.start();
  const resetter = config.demoMode ? new DemoResetter(pool, config) : null;
  resetter?.start();
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    try {
      scheduler.stop();
      resetter?.stop();
      await app.close();
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error("shutdown failed", err);
      process.exit(1);
    }
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  console.log(`API listening on ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
