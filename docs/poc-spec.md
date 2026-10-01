# POC Spec: Late Payment Invoice Reminders

Slug: `invoice-reminders`
Branch: `poc/invoice-reminders`
Source idea: `docs/trend-ideas.md`, idea #1 (Late Payment Invoice Reminder Automation).

Start: `docker compose up -d --build --force-recreate --wait`
Stop: `docker compose down`

Both commands run from the repository root. `Stop:` keeps the database volume (no data is deleted).

## 1. Goal and 5-minute demo

A freelancer or small service business tracks invoices, defines escalating reminder rules (1, 10, and 30 days after the due date), and the app emails clients on a schedule and logs every reminder and payment.

Demo script (under 5 minutes):
1. Invoices page: click "Import from Stripe (mock)" to pull 4 seeded invoices (3 overdue). Create one more invoice by hand.
2. Rules page: show the 3 default escalation steps, edit a template subject.
3. Dashboard: click "Run reminders now". Each overdue invoice gets the right escalation step.
4. Open Mailpit (http://localhost:18025) and show the emails, including the customer pay link.
5. Click the pay link, pay (mock), and show the dashboard "Recovered after reminder" counter and the invoice's reminder history.

Out of scope: authentication, multiple users/tenants, real Stripe/QuickBooks APIs, SMS, real email providers, deployment.

## 2. Stack and why

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js 22 + TypeScript + Fastify 5 | One toolchain (Node/npm) for backend and web, so the Windows host needs only Node and Docker. Fastify `inject()` gives fast HTTP tests without opening ports. |
| Database | PostgreSQL 16 (plain Postgres in Docker) | Relational data (invoices, rules, reminder log) with date arithmetic in SQL. Supabase adds nothing this POC needs. |
| Client | Web: Next.js (15 or later, App Router) + React + TypeScript + Tailwind CSS | No device capability is needed; a dashboard is a web app. |
| Email | Nodemailer over SMTP to Mailpit (`axllent/mailpit`) in Docker | No accounts or secrets. Real providers plug in behind the `EmailSender` interface. |
| Accounting import | `MockStripeSource` reading a JSON fixture | No accounts or secrets. Real Stripe/QuickBooks plug in behind the `InvoiceSource` interface. |
| Backend libs | `pg`, `zod`, `nodemailer`, `@fastify/cors`, `@fastify/formbody`, `tsx` (runtime and dev), `vitest`, `typescript` | Small, well-known. |

Backend module format: `"type": "module"`, tsconfig `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"noEmit": true`, `"strict": true`. The backend runs TypeScript directly with `tsx` in dev and in Docker (no compile step), so extensionless relative imports work. `npm run typecheck` is `tsc --noEmit`.

## 3. Repository layout and where dependencies live

```
docker-compose.yml          # project name: invoice-reminders
.env.example                # all variables, with the same defaults compose uses
.gitignore
docker/db/init/01-create-test-db.sql   # CREATE DATABASE invoice_reminders_test;
backend/
  package.json  package-lock.json  tsconfig.json  vitest.config.ts  Dockerfile  .dockerignore
  migrations/001_init.sql   # (later migrations 002_..., 003_... if needed)
  src/
    server.ts               # loads config, runs migrations, seeds default rules, listens 0.0.0.0:4000, starts scheduler
    app.ts                  # buildApp({ pool, emailSender, config }) -> Fastify instance (no listen, no scheduler)
    config.ts
    dates.ts                # todayUtc(): "YYYY-MM-DD"
    db/pool.ts  db/migrate.ts  db/seed.ts
    routes/health.ts  invoices.ts  imports.ts  rules.ts  reminders.ts  stats.ts  pay.ts  scheduler.ts
    email/types.ts  email/smtp.ts  email/memory.ts  email/index.ts
    sources/types.ts  sources/mock-stripe.ts  sources/fixtures/mock-stripe-invoices.json
    reminders/templates.ts  reminders/engine.ts  reminders/scheduler.ts
  tests/
    global-setup.ts         # creates invoice_reminders_test if missing, runs migrations on it
    helpers.ts              # testPool, resetDb(), makeApp() with MemoryEmailSender
    health.test.ts  invoices.test.ts  import.test.ts  templates.test.ts  rules.test.ts
    reminders.test.ts  scheduler.test.ts  smtp-mailpit.test.ts  pay.test.ts  stats.test.ts
web/
  package.json  package-lock.json  tsconfig.json  next.config.ts  Dockerfile  .dockerignore
  src/app/layout.tsx        # header "Invoice Reminders" + nav links Dashboard (/), Invoices (/invoices), Rules (/rules)
  src/app/page.tsx          # Dashboard
  src/app/invoices/page.tsx
  src/app/invoices/[id]/page.tsx
  src/app/rules/page.tsx
  src/lib/api.ts            # typed fetch client; base URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:14000"
  src/lib/format.ts         # formatMoney(cents, currency), parseAmountToCents("480.00")
```

Dependencies:
- Host needs Node.js 20+ with npm, Docker Desktop, and Git Bash. Nothing is installed globally.
- `backend/node_modules` and `web/node_modules` (installed with `npm install` inside each folder; lockfiles committed). There is no Python and no virtual environment in this POC.
- Docker images install their own dependencies with `npm ci`. `.dockerignore` in both folders excludes `node_modules`, `.next`, `dist`, `coverage` so Windows binaries never enter Linux images.

## 4. Local infrastructure

`docker-compose.yml` (top-level `name: invoice-reminders`). Every value uses `${VAR:-default}` so no `.env` file is required.

| Service | Image / build | Host port -> container | Healthcheck |
|---|---|---|---|
| `db` | `postgres:16-alpine`; env `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=invoice_reminders`; volume `pgdata`; mounts `./docker/db/init` to `/docker-entrypoint-initdb.d` | 15432 -> 5432 | `pg_isready -U postgres -d invoice_reminders` |
| `mailpit` | `axllent/mailpit` | 11025 -> 1025 (SMTP), 18025 -> 8025 (web UI and API) | `["CMD", "/mailpit", "readyz"]` |
| `api` | build `./backend` | 14000 -> 4000 | `wget -qO /dev/null http://127.0.0.1:4000/api/health \|\| exit 1` |
| `web` | build `./web` (build arg `NEXT_PUBLIC_API_URL=http://localhost:14000`) | 13000 -> 3000 | `wget -qO /dev/null http://127.0.0.1:3000/ \|\| exit 1` |

- `api` depends on `db` and `mailpit` (`condition: service_healthy`); `web` depends on `api` (`service_healthy`).
- Healthchecks use `127.0.0.1`, not `localhost` (Alpine resolves `localhost` to `::1` and the servers listen on IPv4). Fastify listens on `0.0.0.0`; Next standalone gets `HOSTNAME=0.0.0.0`, `PORT=3000`.
- `api` container env: `TZ=UTC`, `DATABASE_URL=postgres://postgres:postgres@db:5432/invoice_reminders`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `FROM_EMAIL`, `BUSINESS_NAME`, `PUBLIC_API_URL=http://localhost:14000`, `WEB_ORIGIN=http://localhost:13000`, `SCHEDULER_INTERVAL_SECONDS=3600`.
- `backend/Dockerfile`: `node:22-alpine`, `npm ci`, copy source (including `migrations/`), `CMD ["node", "--import", "tsx", "src/server.ts"]`. Migrations are read from `<cwd>/migrations`.
- `web/Dockerfile`: multi-stage `node:22-alpine`, `next.config.ts` sets `output: "standalone"`, `ARG NEXT_PUBLIC_API_URL` available at build, runtime copies `.next/standalone`, `.next/static`, `public`.

Databases:
- App database: `invoice_reminders`. Test database: `invoice_reminders_test` on the same server. The init SQL creates it on a fresh volume, and `tests/global-setup.ts` also creates it if missing (connecting to the `postgres` database), then runs migrations on it.
- Tests connect with `TEST_DATABASE_URL`, default `postgres://postgres:postgres@127.0.0.1:15432/invoice_reminders_test`. `resetDb()` refuses to run unless the database name ends in `_test`, then runs `TRUNCATE reminders, invoices, reminder_rules RESTART IDENTITY CASCADE` and re-seeds the default rules. Tests never touch `invoice_reminders`.
- `vitest.config.ts`: `fileParallelism: false` (all files share one test DB), `globalSetup: "tests/global-setup.ts"`. `npm test` is `vitest run`.

`.env.example` lists: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`, `TEST_DATABASE_URL`, `EMAIL_PROVIDER` (`smtp` or `memory`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL` (default `Demo Studio <billing@demo-studio.test>`), `BUSINESS_NAME` (default `Demo Studio`), `PUBLIC_API_URL`, `WEB_ORIGIN`, `SCHEDULER_INTERVAL_SECONDS`, `NEXT_PUBLIC_API_URL`, `TEST_SMTP_HOST` (127.0.0.1), `TEST_SMTP_PORT` (11025), `TEST_MAILPIT_API` (http://127.0.0.1:18025). No real secrets.

`.gitignore` covers: `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `*secret*`, `node_modules/`, `.next/`, `out/`, `dist/`, `build/`, `coverage/`, `test-results/`, `playwright-report/`, `*.tsbuildinfo`, `next-env.d.ts`, `*.log`, `.venv/`, `.poc-artifacts/`.

Ports in use: 15432 (Postgres), 11025 (SMTP), 18025 (Mailpit UI), 14000 (API), 13000 (web). All below 49152.

## 5. Data model (`backend/migrations/001_init.sql`)

`schema_migrations(filename text primary key, applied_at timestamptz default now())`, managed by `db/migrate.ts` (applies `migrations/*.sql` in name order, each once).

`invoices`
| column | type | notes |
|---|---|---|
| id | serial PK | |
| number | text not null | not unique (manual entry may repeat) |
| client_name | text not null | |
| client_email | text not null | |
| amount_cents | integer not null check (> 0) | |
| currency | char(3) not null default 'USD' | |
| issue_date | date not null default current_date | |
| due_date | date not null | |
| status | text not null default 'unpaid' check in ('unpaid','paid') | |
| paid_at | timestamptz null | |
| paid_via | text null check in ('manual','pay_link') | |
| source | text not null default 'manual' check in ('manual','mock_stripe') | |
| external_id | text null | unique together with `source` |
| pay_token | text not null unique | random 32 hex chars, set on insert |
| created_at | timestamptz not null default now() | |

`reminder_rules` (a rule is one escalation step and owns its email template)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| name | text not null | |
| offset_days | integer not null check (offset_days between 1 and 365) | days after the due date |
| subject_template | text not null | |
| body_template | text not null | plain text |
| active | boolean not null default true | |
| created_at | timestamptz not null default now() | |

`reminders` (log of every send attempt)
| column | type | notes |
|---|---|---|
| id | serial PK | |
| invoice_id | integer not null references invoices on delete cascade | |
| rule_id | integer null references reminder_rules on delete set null | |
| rule_name | text not null | snapshot |
| rule_offset_days | integer not null | snapshot; drives escalation |
| trigger | text not null check in ('scheduled','manual') | |
| to_email | text not null | |
| subject | text not null | rendered |
| body | text not null | rendered |
| status | text not null check in ('sent','failed') | |
| error | text null | |
| sent_at | timestamptz not null default now() | |

Default rules (`db/seed.ts`, `seedDefaultRules(pool)` inserts them only when `reminder_rules` is empty; called by `server.ts` at startup and by `resetDb()`):
1. `Friendly nudge`, offset 1. Subject `Friendly reminder: invoice {{invoice_number}} is past due`. Body: `Hi {{client_name}},\n\nJust a friendly reminder that invoice {{invoice_number}} for {{amount}} was due on {{due_date}}. You can pay online here: {{pay_link}}\n\nThanks,\n{{business_name}}`
2. `Firm reminder`, offset 10. Subject `Reminder: invoice {{invoice_number}} is {{days_overdue}} days overdue`. Body asks for payment of `{{amount}}`, includes `{{pay_link}}`, signed `{{business_name}}`.
3. `Final notice`, offset 30. Subject `Final notice: invoice {{invoice_number}} is {{days_overdue}} days overdue`. Body says this is the final reminder, includes `{{amount}}`, `{{pay_link}}`, `{{business_name}}`.

Implementation notes (load-bearing):
- Register `pg.types.setTypeParser(1082, v => v)` so `date` columns stay `"YYYY-MM-DD"` strings (no timezone shift).
- `SUM`/`COUNT` come back as strings; convert to numbers before returning JSON.
- Add `pool.on("error", ...)` logging so a database restart never crashes the API process.
- "Today" is `todayUtc()`; containers run with `TZ=UTC`. Day differences are computed in SQL as `($as_of::date - due_date)`.

## 6. Domain rules

- `days_overdue(as_of) = as_of - due_date` in days. An invoice is overdue when `status = 'unpaid'` and `days_overdue >= 1`.
- `display_status`: `paid` if paid, `overdue` if overdue, otherwise `open`. UI badge labels: `Paid`, `Overdue`, `Open`.
- `last_offset` for an invoice = max `rule_offset_days` over its reminders with `status = 'sent'`, or -1 if none.
- Scheduled run (`runDueReminders(asOf)`): for each overdue invoice, eligible rules are active rules with `offset_days <= days_overdue` and `offset_days > last_offset`. If any, send the one with the largest `offset_days` (ties: lowest id), with `trigger = 'scheduled'`. At most one email per invoice per run. Running twice on the same date sends nothing new. A failed send is logged with `status = 'failed'` and does not advance `last_offset`, so the next run retries. Example: an invoice 12 days overdue with nothing sent gets `Firm reminder`; 35 days overdue gets `Final notice`.
- Manual "send next reminder" (`sendNextReminder(invoiceId)`): 409 if the invoice is paid. Rule = active rule with the smallest `offset_days > last_offset`; if none, the active rule with the largest `offset_days` (repeat final step); if there are no active rules, 409. Allowed even when not yet overdue. `trigger = 'manual'`.
- Templates: `{{name}}` placeholders, whitespace inside braces allowed. Allowed names: `client_name`, `invoice_number`, `amount` (formatted, e.g. `$1,250.00` via `Intl.NumberFormat("en-US", { style: "currency", currency })`), `due_date` (`YYYY-MM-DD`), `days_overdue` (integer, minimum 0), `business_name`, `pay_link`. Creating or updating a rule with an unknown placeholder returns 400 with an error containing `Unknown placeholder` and the allowed names.
- `pay_url` = `${PUBLIC_API_URL}/pay/${pay_token}`.
- Scheduler (`reminders/scheduler.ts`): when `SCHEDULER_INTERVAL_SECONDS > 0`, `setInterval` calls `tick()`, which runs `runDueReminders(todayUtc())` and records `last_run_at`, `last_result`. The first tick happens one interval after start (not at startup). `0` disables it. `buildApp` never starts the scheduler; `server.ts` does. Tests call `tick()` directly.

Pluggable providers:
- `EmailSender { send(msg: { to: string; from: string; subject: string; text: string }): Promise<void> }`. `SmtpEmailSender` (nodemailer, `SMTP_HOST`/`SMTP_PORT`, optional auth) and `MemoryEmailSender` (keeps `sent[]`, can be told to fail). `email/index.ts` picks by `EMAIL_PROVIDER`. A future `ResendEmailSender` or `SesEmailSender` only implements `send`.
- `InvoiceSource { name: string; fetchInvoices(today: string): Promise<ExternalInvoice[]> }`. `MockStripeSource` reads the fixture, where due dates are relative (`due_in_days`) so they are always overdue at demo time:
  - `mock_in_1001` `STR-1001` Acme Design Co, billing@acme.test, 125000 cents, due_in_days -3
  - `mock_in_1002` `STR-1002` Brightside Plumbing, accounts@brightside.test, 48000, -12
  - `mock_in_1003` `STR-1003` Northwind Coaching, pay@northwind.test, 240000, -35
  - `mock_in_1004` `STR-1004` Lumen Studio, hello@lumen.test, 90000, +7

## 7. API

Base URL `http://localhost:14000`. JSON unless noted. CORS allows `WEB_ORIGIN`. Errors: `400 {"error":"Validation failed","details":[...]}`, `404 {"error":"Invoice not found"}` (or `Rule not found`), `409 {"error":"..."}`.

Shapes:
- `Invoice`: `{ id, number, client_name, client_email, amount_cents, currency, issue_date, due_date, status, display_status, days_overdue, paid_at, paid_via, source, external_id, pay_url, reminders_sent, last_reminder: { rule_name, sent_at } | null, created_at }`. `days_overdue` is 0 when not overdue or paid. `reminders_sent` counts `status = 'sent'` reminders.
- `Rule`: `{ id, name, offset_days, subject_template, body_template, active, created_at }`.
- `Reminder`: `{ id, invoice_id, invoice_number, client_name, rule_id, rule_name, rule_offset_days, trigger, to_email, subject, body, status, error, sent_at }`.

| Method and path | Body | Response |
|---|---|---|
| `GET /api/health` | | `200 {"status":"ok","db":"ok"}` (db checked with `SELECT 1`; `503` with `"db":"error"` if it fails) |
| `GET /api/invoices?status=all\|overdue\|paid\|unpaid` | | `200 Invoice[]`, newest first (`created_at desc, id desc`). Default `all`. |
| `POST /api/invoices` | `{ number, client_name, client_email, amount_cents, currency?, issue_date?, due_date }` | `201 Invoice`. Validation: number 1-50 chars, client_name 1-200, valid email, amount_cents positive integer, currency 3 letters, dates `YYYY-MM-DD`. |
| `GET /api/invoices/:id` | | `200 Invoice & { reminders: Reminder[] }` (newest first) or 404 |
| `POST /api/invoices/:id/mark-paid` | | `200 Invoice` (`paid_via = 'manual'`); idempotent on an already-paid invoice |
| `POST /api/invoices/:id/send-reminder` | | `201 { reminder: Reminder }`; `409` if paid or no active rules; `502 {"error":"Email delivery failed","reminder":...}` if the sender throws |
| `POST /api/import/mock-stripe` | | `200 { "imported": n, "skipped": n }`; upsert key `(source, external_id)`, existing rows are skipped |
| `GET /api/rules` | | `200 Rule[]` ordered by `offset_days asc, id asc` |
| `POST /api/rules` | `{ name, offset_days, subject_template, body_template, active? }` | `201 Rule` or 400 |
| `PUT /api/rules/:id` | any subset of the POST fields | `200 Rule`, 400, or 404 |
| `POST /api/reminders/run` | `{ as_of?: "YYYY-MM-DD" }` | `200 { as_of, checked, sent, failed, results: [{ invoice_id, invoice_number, rule_name, status }] }` (`checked` = overdue invoices examined) |
| `GET /api/reminders?limit=20` | | `200 Reminder[]` newest first (activity feed), limit 1-100 |
| `GET /api/stats` | | `200 { outstanding_cents, overdue_count, overdue_cents, reminders_sent, paid_after_reminder_count, paid_after_reminder_cents, currency: "USD" }`. "Paid after reminder" = paid invoices with at least one `sent` reminder whose `sent_at <= paid_at`. |
| `GET /api/scheduler` | | `200 { enabled, interval_seconds, last_run_at, next_run_at, last_result: { sent, failed } \| null }` |
| `GET /pay/:token` | | `text/html` mock checkout: heading `Pay invoice <number>`, client name, amount, and a form (`POST /pay/:token`) with button `Pay <amount> (mock)`, e.g. `Pay $300.00 (mock)`. If already paid: `This invoice is already paid.` Unknown token: 404 HTML. All values HTML-escaped. |
| `POST /pay/:token` | (form post) | `text/html` containing `Payment received. Thank you!`; sets `status='paid'`, `paid_at=now()`, `paid_via='pay_link'`. Already paid: same page, no change. Unknown token: 404. |

## 8. Web client

All pages are client components (`"use client"`) that fetch from `NEXT_PUBLIC_API_URL`. Headings, buttons, and links named below must be literal JSX text rendered immediately (not hidden behind a loading state), because `verify` checks them in the server-rendered HTML. Dates show as `YYYY-MM-DD`; money via `formatMoney`.

- Layout: header text `Invoice Reminders`, nav links `Dashboard`, `Invoices`, `Rules`.
- `/invoices` (heading `Invoices`):
  - Buttons `Import from Stripe (mock)` (shows message `Imported X, skipped Y`) and `New invoice` (toggles a form).
  - New invoice form fields with labels `Number`, `Client name`, `Client email`, `Amount` (dollars, e.g. `480.00`, converted to cents), `Due date` (`<input type="date">`), submit button `Create invoice`. Validation errors from the API show above the form.
  - Filter tabs (buttons) `All`, `Overdue`, `Paid`.
  - Table columns: `Number` (link to `/invoices/[id]`), `Client`, `Amount`, `Due date`, `Status` (badge `Open`/`Overdue`/`Paid`), `Days overdue` (number when overdue, `-` otherwise), `Reminders` (count), `Last reminder` (rule name or `-`), `Actions` (buttons `Send next reminder` and `Mark paid`, both hidden for paid invoices).
  - `Send next reminder` shows message `Reminder sent: <rule name>` and refreshes the row.
- `/invoices/[id]` (read id with `useParams()`): link `Back to invoices` (always rendered), heading `Invoice <number>`, client, amount, due date, status badge, days overdue, link `Open customer pay link` (plain `<a href={pay_url}>`, same tab), buttons `Send next reminder` and `Mark paid` (hidden when paid), section heading `Reminder history` listing reminders newest first, each showing rule name, trigger (`manual`/`scheduled`), status, subject, and sent time. Empty list text: `No reminders sent yet.` Unknown id shows `Invoice not found`.
- `/rules` (heading `Reminder rules`): button `Add rule`; table columns `Name`, `Days after due` (e.g. `10 days`), `Subject`, `Status` (button reading `Active` or `Inactive` that toggles via `PUT`), `Actions` (button `Edit`). Edit and Add use one form with labels `Name`, `Days after due`, `Subject`, `Body` and buttons `Save` (edit) or `Create rule` (add), plus `Cancel`. API errors (for example `Unknown placeholder ...`) show inside the form. A help line lists the allowed placeholders.
- `/` Dashboard (heading `Dashboard`): stat cards `Outstanding` (money), `Overdue invoices` (count, money below), `Reminders sent` (count), `Recovered after reminder` (count as the large number, money below). Button `Run reminders now` shows `Run complete: checked X, sent Y, failed Z` and refreshes the page data. Scheduler line from `GET /api/scheduler`: `Scheduler: every 60 min, next run <time>` (`every N s` if not a whole minute, `Scheduler: off` when disabled). Section `Recent activity` lists `GET /api/reminders?limit=20`: invoice number, client, rule name, trigger, status, time.

## 9. Tests and verify conventions

- Every `verify` runs from the repository root in Git Bash and uses only Docker Compose, curl, grep, Node, and npm.
- Backend tests use `buildApp()` with `MemoryEmailSender` and the test DB, call `resetDb()` in `beforeEach`, and pass explicit `as_of` dates where results depend on "today". `smtp-mailpit.test.ts` is the only test that uses real SMTP: it sends through `SmtpEmailSender` to `TEST_SMTP_HOST:TEST_SMTP_PORT` with a unique subject, then polls `GET {TEST_MAILPIT_API}/api/v1/messages` for up to 5 s until that subject appears. It never deletes Mailpit messages.
- Web tasks verify with `npm run typecheck` (`tsc --noEmit`), `npm run build`, then start the stack and `curl` the page for a literal string.

## 10. Task scope (build order)

- **T00 Scaffold** (backend-infra-dev): everything in sections 3 and 4: compose file, both Dockerfiles and `.dockerignore`s, `.env.example`, `.gitignore`, test-DB init SQL, backend skeleton (`config`, `pool`, `migrate`, empty `001_init.sql` is fine, `app.ts` with CORS and `GET /api/health`, `server.ts`, `vitest.config.ts`, `tests/global-setup.ts`, `tests/helpers.ts`, `tests/health.test.ts`), web skeleton (Next.js + Tailwind, layout with header and nav, placeholder `/` page, `lib/api.ts`, `lib/format.ts`), `npm install` in both folders. Scripts: backend `dev`, `start`, `typecheck`, `test`; web `dev`, `build`, `start`, `typecheck`.
- **T01 Invoices API** (backend-infra-dev): full `001_init.sql` schema, `seedDefaultRules` (templates as in section 5), `resetDb` re-seeding, invoice endpoints (list with filter, create, get with reminders array, mark-paid), `InvoiceSource` + `MockStripeSource` + fixture + `POST /api/import/mock-stripe`. Tests `tests/invoices.test.ts` (validation 400s, derived `display_status`/`days_overdue`, filter, newest-first order, mark-paid idempotent, 404) and `tests/import.test.ts` (first import 4/0, second 0/4, three overdue).
- **T02 Rules API and templates** (backend-infra-dev): `reminders/templates.ts` (`renderTemplate`, `findUnknownPlaceholders`, `buildTemplateVars(invoice, asOf, config)`), rules endpoints. Tests `tests/templates.test.ts` (all placeholders, whitespace in braces, money formatting, unknown placeholders) and `tests/rules.test.ts` (defaults seeded and ordered, create, partial update, toggle active, 400 for unknown placeholder and bad offset, 404).
- **T03 Email and reminder engine** (backend-infra-dev): `EmailSender` implementations and factory, `engine.ts` (`runDueReminders`, `sendNextReminder`) per section 6, `POST /api/reminders/run`, `POST /api/invoices/:id/send-reminder`, `GET /api/reminders`, scheduler with `GET /api/scheduler`, scheduler started in `server.ts`. Tests `tests/reminders.test.ts` (12 days overdue -> Firm reminder; 35 -> Final notice; second run same date sends nothing; later date escalates; paid and not-yet-due skipped; inactive rules ignored; failed send logged and retried; manual send order 1 -> 10 -> 30 -> repeat 30; manual 409 when paid; rendered subject/body contain invoice number, amount, pay link), `tests/scheduler.test.ts` (`tick()` sends and records `last_run_at`; interval 0 disabled), `tests/smtp-mailpit.test.ts`.
- **T04 Pay link and stats** (backend-infra-dev): `GET`/`POST /pay/:token` (register `@fastify/formbody`), `GET /api/stats`. Tests `tests/pay.test.ts` (page content and button text, POST marks paid with `pay_link`, already paid, 404, HTML escaping) and `tests/stats.test.ts` (sums and counts, paid-after-reminder counts only reminders sent before payment).
- **T05 Invoices page** (fullstack-dev): layout nav final, `/invoices` list, filter tabs, New invoice form, import button, Mark paid, `Days overdue` and badges. (`Send next reminder` button may render but is wired in T06.)
- **T06 Invoice detail and manual reminders** (fullstack-dev): `/invoices/[id]` page as in section 8, `Send next reminder` on the list rows and on the detail page.
- **T07 Rules page** (fullstack-dev): `/rules` as in section 8.
- **T08 Dashboard** (fullstack-dev): `/` as in section 8.

Acceptance steps use the date relative to today; "12 days before today" means today's local date minus 12 days, entered as `YYYY-MM-DD`. Numbers like `QA-<HHMMSS>` use the current time so each run creates new data; newest invoices appear in the first table row.
