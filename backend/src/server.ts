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
  if (config.dbCreateIfMissing) await ensureDatabase(config.databaseUrl);
  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);
  await seedDefaultRules(pool);
  if (config.demoMode) await checkAndResetIfStale(pool, config);
  const emailSender = createEmailSender(config);
  const scheduler = new Scheduler({ pool, emailSender, config });
  const app = await buildApp({ pool, emailSender, config, scheduler });
  await app.listen({ host: "0.0.0.0", port: config.port });
  scheduler.start();
  if (config.demoMode) new DemoResetter(pool, config).start();
  console.log(`API listening on ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
