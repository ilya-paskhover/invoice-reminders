// Records the README demo: a .webm walkthrough video and an animated .gif of the key moments.
// Needs the local demo stack (docker-compose.demo.yml). Usage: npm run demo-video [-- --out <dir>] [-- --frames <dir>]
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import gifenc from "gifenc";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0";
const { chromium } = await import("playwright");
const { GIFEncoder, quantize, applyPalette } = gifenc;

const args = process.argv.slice(2);
function opt(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const out = resolve(opt("out", "../docs/demo"));
const web = opt("web", "http://localhost:13000").replace(/\/$/, "");
const api = opt("api", "http://localhost:14000").replace(/\/$/, "");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

let meta;
try {
  meta = await (await fetch(`${api}/api/meta`)).json();
} catch {
  meta = null;
}
if (!meta || meta.demo_mode !== true) {
  fail(
    "Start the demo stack first: docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --force-recreate --wait",
  );
}
const reset = await fetch(`${api}/api/demo/reset`, { method: "POST" });
if (!reset.ok) fail(`Demo reset failed: HTTP ${reset.status}`);

// Due date 12 days ago in UTC, matching how the API counts days overdue.
const due = new Date(Date.now() - 12 * 86400000).toISOString().slice(0, 10);

mkdirSync(out, { recursive: true });
const videoTmp = resolve(out, ".video-tmp");
const size = { width: 1280, height: 800 };
const frames = []; // { png: Buffer, delay: ms }

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 1,
  recordVideo: { dir: videoTmp, size },
});
const page = await context.newPage();

async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;" +
        "background:rgba(15,23,42,.88);color:#fff;font:600 18px/1.4 Inter,system-ui,sans-serif;" +
        "padding:10px 20px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function frame(text, delay = 2200, hold = 1200) {
  await caption(text);
  await page.waitForTimeout(300);
  frames.push({ png: await page.screenshot(), delay });
  await page.waitForTimeout(hold); // keep the moment on screen in the video
}

async function visible(text) {
  await page.getByText(text).first().waitFor({ state: "visible", timeout: 30000 });
}

try {
  await page.goto(`${web}/`, { waitUntil: "load" });
  await visible("$10,330.00");
  await frame("Dashboard: what is outstanding, overdue, and recovered");

  await page.getByRole("link", { name: "Invoices", exact: true }).click();
  await visible("Harbor & Pine Interiors");
  await page.getByRole("button", { name: "Import from Stripe (mock)" }).click();
  await visible("Imported");
  await frame("Import overdue invoices (mock Stripe)");

  await page.getByRole("button", { name: "New invoice" }).click();
  const type = (label, value) => page.getByLabel(label, { exact: true }).pressSequentially(value, { delay: 40 });
  await type("Number", "INV-2050");
  await type("Client name", "Bluebird Cafe");
  await type("Client email", "accounts@bluebird.test");
  await type("Amount", "640.00");
  await page.getByLabel("Due date", { exact: true }).fill(due);
  await page.getByLabel("Due date", { exact: true }).blur();
  await frame("Add an invoice that is 12 days overdue", 2200, 600);
  await page.getByRole("button", { name: "Create invoice" }).click();
  await visible("Bluebird Cafe");

  const row = page.getByRole("row").filter({ hasText: "INV-2050" });
  await row.getByRole("button", { name: "Send next reminder" }).click();
  await visible("Reminder sent:");
  await frame("Send the next escalation step in one click");

  await page.getByRole("link", { name: "Rules", exact: true }).click();
  await visible("Final notice");
  await frame("Escalation rules: 1, 10 and 30 days after the due date");

  await page.getByRole("link", { name: "Outbox", exact: true }).click();
  await visible("INV-2050");
  await frame("Outbox: the rendered email with a customer pay link");

  await page.getByRole("link", { name: "Open pay link" }).first().click();
  await visible("Pay invoice INV-2050");
  await frame("The customer opens the pay link");
  await page.getByRole("button", { name: /Pay .* \(mock\)/ }).click();
  await visible("Payment received. Thank you!");
  await frame("Paid (mock checkout)");

  await page.goto(`${web}/`, { waitUntil: "load" });
  await visible("Recovered after reminder");
  await page.waitForLoadState("networkidle").catch(() => {});
  await frame("Recovered after reminder goes up", 3500, 2000);
} finally {
  await context.close(); // flushes the video
  const video = page.video();
  if (video) await video.saveAs(resolve(out, "demo.webm"));
  await browser.close();
  rmSync(videoTmp, { recursive: true, force: true });
}

const framesDir = opt("frames", "");
if (framesDir) {
  mkdirSync(resolve(framesDir), { recursive: true });
  frames.forEach((f, i) => writeFileSync(resolve(framesDir, `frame-${String(i + 1).padStart(2, "0")}.png`), f.png));
}

const gif = GIFEncoder();
for (const f of frames) {
  const { width, height, data } = PNG.sync.read(f.png);
  const palette = quantize(data, 256);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: f.delay });
}
gif.finish();
writeFileSync(resolve(out, "demo.gif"), gif.bytes());
console.log(`saved ${resolve(out, "demo.webm")}`);
console.log(`saved ${resolve(out, "demo.gif")} (${frames.length} frames)`);
