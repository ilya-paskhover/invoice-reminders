import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
const require = createRequire(import.meta.url);
const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
const r = spawnSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
