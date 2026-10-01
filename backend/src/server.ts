import { loadConfig } from "./config";
import { createPool } from "./db/pool";
import { runMigrations } from "./db/migrate";
import { buildApp } from "./app";
import type { EmailSender } from "./email/types";

async function main() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);
  // Real email sender is wired in a later task.
  const emailSender: EmailSender = {
    async send() {
      throw new Error("Email sender not configured yet");
    },
  };
  const app = await buildApp({ pool, emailSender, config });
  await app.listen({ host: "0.0.0.0", port: config.port });
  console.log(`API listening on ${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
