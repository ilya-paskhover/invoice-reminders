import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";
const { chromium } = await import("playwright");

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const out = resolve(opt("out", "../docs/screenshots"));
const web = opt("web", "http://localhost:13000").replace(/\/$/, "");
const api = opt("api", "http://localhost:14000").replace(/\/$/, "");

const START =
  "Start the demo stack first: docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --force-recreate --wait";
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

let meta;
try {
  meta = await (await fetch(`${api}/api/meta`)).json();
} catch {
  fail(START);
}
if (!meta || meta.demo_mode !== true) fail(START);

const reset = await fetch(`${api}/api/demo/reset`, { method: "POST" });
if (!reset.ok) fail(`Demo reset failed: HTTP ${reset.status}`);

const invoices = await (await fetch(`${api}/api/invoices`)).json();
const inv2041 = invoices.find((i) => i.number === "INV-2041");
const str1003 = invoices.find((i) => i.number === "STR-1003");
if (!inv2041 || !str1003) fail("Seed invoices INV-2041 / STR-1003 not found");

mkdirSync(out, { recursive: true });

const desktop = { width: 1440, height: 900 };
const shots = [
  { name: "dashboard", url: `${web}/`, text: "$10,330.00" },
  { name: "invoices", url: `${web}/invoices`, text: "Harbor & Pine Interiors" },
  { name: "invoice-detail", url: `${web}/invoices/${inv2041.id}`, text: "Final notice" },
  { name: "rules", url: `${web}/rules`, text: "Friendly nudge" },
  { name: "outbox", url: `${web}/outbox`, text: "INV-2041" },
  { name: "pay-page", url: str1003.pay_url, text: "Pay invoice STR-1003" },
  { name: "dashboard-mobile", url: `${web}/`, text: "$10,330.00", viewport: { width: 390, height: 844 } },
];

const browser = await chromium.launch();
try {
  for (const s of shots) {
    const context = await browser.newContext({
      viewport: s.viewport ?? desktop,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(s.url, { waitUntil: "load" });
    await page.getByText(s.text).first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(300);
    const file = resolve(out, `${s.name}.png`);
    await page.screenshot({ path: file });
    console.log(`saved ${file}`);
    await context.close();
  }
} finally {
  await browser.close();
}
