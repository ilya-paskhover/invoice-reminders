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
// Headless recordings have no mouse pointer, so draw one that follows the real mouse events.
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById("demo-cursor")) return;
    const c = document.createElement("div");
    c.id = "demo-cursor";
    c.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const start = JSON.parse(sessionStorage.getItem("demo-cursor") || '{"x":640,"y":400}');
    c.style.cssText = `position:fixed;left:0;top:0;z-index:100000;pointer-events:none;transform:translate(${start.x}px,${start.y}px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))`;
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => {
      c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      sessionStorage.setItem("demo-cursor", JSON.stringify({ x: e.clientX, y: e.clientY }));
    }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;background:rgba(79,70,229,.35);z-index:99999;pointer-events:none;transition:transform .5s ease-out,opacity .5s ease-out`;
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = "scale(2.2)"; r.style.opacity = "0"; });
      setTimeout(() => r.remove(), 600);
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
});

const page = await context.newPage();
const started = Date.now();

// Glide the visible cursor to the element, pause, then click it for real.
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 35 });
  await page.waitForTimeout(450);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(500);
}

async function type(label, value) {
  await click(page.getByLabel(label, { exact: true }));
  await page.keyboard.type(value, { delay: 85 });
  await page.waitForTimeout(300);
}

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

// Caption shown before an action, so the viewer knows what is about to happen.
async function say(text, ms = 1800) {
  await caption(text);
  await page.waitForTimeout(ms);
}

// A result worth looking at: caption, GIF frame, and a long hold in the video.
async function frame(text, delay = 2600, hold = 3500) {
  await caption(text);
  await page.waitForTimeout(300);
  frames.push({ png: await page.screenshot(), delay });
  await page.waitForTimeout(hold);
}

async function visible(text) {
  await page.getByText(text).first().waitFor({ state: "visible", timeout: 30000 });
}

try {
  await page.goto(`${web}/`, { waitUntil: "load" });
  await visible("$10,330.00");
  await page.mouse.move(640, 400);
  await frame("Dashboard: money outstanding, overdue invoices, reminders sent", 2600, 3000);
  await click(page.getByText("Recovered after reminder").first());
  await frame("Recovered after reminder: 2 invoices were paid after a reminder", 2600, 3000);

  await say("Open the invoice list");
  await click(page.getByRole("link", { name: "Invoices", exact: true }));
  await visible("Harbor & Pine Interiors");
  await say("Pull overdue invoices from Stripe (mocked for the demo)");
  await click(page.getByRole("button", { name: "Import from Stripe (mock)" }));
  await visible("Imported");
  await frame("Import done: invoices already in the list are skipped", 2600, 2500);

  await say("Add a new invoice by hand");
  await click(page.getByRole("button", { name: "New invoice" }));
  await type("Number", "INV-2050");
  await type("Client name", "Bluebird Cafe");
  await type("Client email", "accounts@bluebird.test");
  await type("Amount", "640.00");
  await click(page.getByLabel("Due date", { exact: true }));
  await page.getByLabel("Due date", { exact: true }).fill(due);
  await page.getByLabel("Due date", { exact: true }).blur();
  await frame("Due date 12 days ago, so this invoice is overdue", 2600, 2500);
  await click(page.getByRole("button", { name: "Create invoice" }));
  await visible("Bluebird Cafe");
  await frame("The new invoice shows as Overdue, 12 days", 2600, 3000);

  await say("Send it the next reminder step");
  const row = page.getByRole("row").filter({ hasText: "INV-2050" });
  await click(row.getByRole("button", { name: "Send next reminder" }));
  await visible("Reminder sent:");
  await frame("First step sent: Friendly nudge (Reminders: 1)", 2600, 3500);

  await say("The escalation steps are configurable");
  await click(page.getByRole("link", { name: "Rules", exact: true }));
  await visible("Final notice");
  await frame("Rules: 1, 10 and 30 days after the due date, each with its own email", 2600, 3500);

  await say("See the email that was sent");
  await click(page.getByRole("link", { name: "Outbox", exact: true }));
  await visible("INV-2050");
  await frame("Outbox: the rendered email, with a pay link for the customer", 2600, 4000);

  await say("Now act as the customer: open the pay link");
  await click(page.getByRole("link", { name: "Open pay link" }).first());
  await visible("Pay invoice INV-2050");
  await frame("The customer's checkout page (mock, no real payment)", 2600, 2500);
  await click(page.getByRole("button", { name: /Pay .* \(mock\)/ }));
  await visible("Payment received. Thank you!");
  await frame("Paid", 2000, 2500);

  await say("Back to the dashboard");
  await page.goto(`${web}/`, { waitUntil: "load" });
  await visible("Recovered after reminder");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(500);
  await click(page.getByText("Recovered after reminder").first());
  await frame("Recovered after reminder went from 2 to 3: the reminder got the invoice paid", 4000, 4500);
} finally {
  await context.close(); // flushes the video
  const video = page.video();
  if (video) await video.saveAs(resolve(out, "demo.webm"));
  await browser.close();
  rmSync(videoTmp, { recursive: true, force: true });
  console.log(`recorded about ${Math.round((Date.now() - started) / 1000)} s`);
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
