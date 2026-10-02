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

## 11. Phase 2: portfolio polish, public demo, deployment config, README

Planned 2026-10-02. T00-T08 stay `passing` and unchanged. Phase 2 turns the POC into a portfolio piece: (a) UI polish, (b) configuration for a public hosted live demo, (c) a README with screenshots. No task needs real accounts, secrets, pushing, or deploying. The user creates the GitHub repo and the Render account, deploys, and records the video. Phase 2 lifts "deployment" from the out-of-scope list in section 1 only as far as deployment config files that are validated locally; agents never deploy.

Commands (all from the repository root):
- `Start:` and `Stop:` are unchanged (top of this file).
- Demo start: `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --force-recreate --wait`. It uses the same ports (13000, 14000) and runs the API and web in demo mode against a separate database `invoice_reminders_demo` on the same Postgres server, so local dev data in `invoice_reminders` is never reset. Run `Start:` to go back to normal mode. `Stop:` stops either mode.

### 11.1 Regression rule (hard constraint for every Phase 2 task)

The final regression re-runs every T00-T08 `verify`, and T05-T08 `acceptance` steps describe the UI. These literal texts must stay exactly as written (case, punctuation, spacing), and the ones marked SSR must stay in the server-rendered HTML (rendered immediately, not behind a loading state):

| Where | Literal texts that must not change |
|---|---|
| Layout (every page) | `Invoice Reminders` (SSR); nav links `Dashboard`, `Invoices`, `Rules` (SSR) |
| `/` Dashboard | heading `Dashboard`; button `Run reminders now` (SSR); stat card labels `Outstanding`, `Overdue invoices`, `Reminders sent`, `Recovered after reminder` (large number = count, money below); message `Run complete: checked X, sent Y, failed Z`; line `Scheduler: every 60 min, next run <time>` (also `every N s`, `Scheduler: off`); section `Recent activity` showing invoice number, client, rule name, trigger, status, time; `No activity yet.` |
| `/invoices` | heading `Invoices`; buttons `Import from Stripe (mock)` (SSR) and `New invoice`; message `Imported X, skipped Y`; labels `Number`, `Client name`, `Client email`, `Amount`, `Due date`; button `Create invoice`; filter buttons `All`, `Overdue`, `Paid`; column headers `Number`, `Client`, `Amount`, `Due date`, `Status`, `Days overdue`, `Reminders`, `Last reminder`, `Actions`; badges `Open`, `Overdue`, `Paid`; `-` for empty Days overdue and Last reminder; buttons `Send next reminder`, `Mark paid`; message `Reminder sent: <rule name>` |
| `/invoices/[id]` | link `Back to invoices` (SSR, always rendered); heading `Invoice <number>`; link `Open customer pay link`; buttons `Send next reminder`, `Mark paid`; section `Reminder history`; `No reminders sent yet.`; `Invoice not found` |
| `/rules` | heading `Reminder rules`; button `Add rule` (SSR); column headers `Name`, `Days after due`, `Subject`, `Status`, `Actions`; `<n> days`; Status buttons `Active` / `Inactive`; button `Edit`; form labels `Name`, `Days after due`, `Subject`, `Body`; buttons `Save`, `Create rule`, `Cancel`; API errors such as `Unknown placeholder ...` inside the form; placeholder help line |
| API pay pages | `Pay invoice <number>`; `Pay <amount> (mock)` such as `Pay $300.00 (mock)`; `This invoice is already paid.`; `Payment received. Thank you!`; `Payment link not found` with status 404 |
| API JSON | `"db":"ok"`, `"interval_seconds":3600`, `"paid_after_reminder_count"`; `/pay/no-such-token` returns 404 |

Rules that keep those texts working:
- Each literal is one contiguous JSX text node. Don't split it (no `{"Run"} reminders now`) and don't apply CSS `uppercase`/`capitalize` to it, because QA reads visible text.
- Keep element types and behaviour: buttons stay `<button>`, links stay links, `Open customer pay link` stays a plain `<a href>` that opens in the same tab, the rules Status control stays a `<button>` whose text is `Active` or `Inactive`, filter tabs stay buttons, and action buttons on paid invoices are hidden (not disabled).
- One DOM per element: no duplicated mobile and desktop copies of tables, rows, or buttons (QA clicks "the first row"). Tables stay `<table>` with the same column order and newest-first rows, and table headers render immediately. At phone width, wrap tables in a horizontally scrolling container.
- Nav links stay visible at every width (no hamburger menu that hides them).
- Trigger and status values show the lowercase API values (`manual`, `scheduled`, `sent`, `failed`), styled as badges if you like.
- The pay pages contain no `<script>`, the already-paid page contains no `(mock)` text, the form keeps `action="/pay/<token>"` exactly, and all values stay HTML-escaped (asserted by `backend/tests/pay.test.ts`).
- Never edit, skip, or weaken an existing test.

### 11.2 Design system and UI polish (T09, T10, fullstack-dev)

- Hand-written shadcn/ui-style components in `web/src/components/ui/`, styled with Tailwind only: `button.tsx` (variants `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`; visible focus ring), `card.tsx`, `badge.tsx` (with `StatusBadge` for `Open` sky/blue, `Overdue` rose/red, `Paid` emerald/green, each a pill with a colour dot), `stat-card.tsx` (label, large value, optional sub-value and icon), `table.tsx` (rounded bordered wrapper with `overflow-x-auto`, header row styling, row hover), `empty-state.tsx`, `skeleton.tsx`, `page-header.tsx` (title, optional description, actions that wrap below the title on small screens), `alert.tsx` (success, error, info), `field.tsx` (label, input, textarea, help text), and a `cn()` class joiner in `web/src/lib/cn.ts`. Do not run the shadcn CLI (it fetches a remote registry); write the components by hand.
- Allowed new web dependencies, installed in `web/` only: `lucide-react` (icons) and `@fontsource-variable/inter` (Inter font bundled from npm, so builds don't download fonts; do not use `next/font/google`). `clsx` is optional.
- Look: slate-50 page background, white cards with a subtle border and shadow, indigo-600 as the primary colour (the main action on each page is a primary button: `Run reminders now`, `New invoice`, `Create invoice`, `Add rule`, `Save`/`Create rule`), Inter with `tabular-nums` for money and counts, consistent spacing, and `max-w-6xl` content with `px-4 sm:px-6`.
- Layout: sticky white header with a small brand mark and `Invoice Reminders`. The nav is a client component (`web/src/components/nav.tsx`) that uses `usePathname()` and sets `aria-current="page"` and an active style on the current link (`/invoices/[id]` counts as Invoices). At phone width the nav sits under the brand and stays visible. Metadata keeps the title `Invoice Reminders` and adds a description.
- Favicon: redesign `web/src/app/icon.svg` as the brand mark, which Next serves as `<link rel="icon">`.
- Dashboard (T09): stat cards in `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` with icons and skeletons while loading (labels always rendered). The scheduler line sits in a muted info row. `Recent activity` is a table: invoice number as a link to `/invoices/[invoice_id]`, client, rule, trigger badge, status badge, time. Its empty state is `No activity yet.`
- Invoices list, detail, and rules (T10): page headers with actions; a segmented control for `All`/`Overdue`/`Paid` (still buttons, `aria-pressed`); the New invoice and rule forms as cards with labelled fields in a responsive grid; success and error messages as alerts; empty states `No invoices yet.` and `No rules yet.`; skeleton rows while loading. The detail page shows a summary card (client and email, amount, due date, status badge, days overdue), the pay-link and action buttons, and `Reminder history` as a vertical timeline of cards (rule name, trigger badge, status badge, subject, sent time). The rules help line shows the placeholders as inline code chips.
- Responsive: every page works at 390 px wide with no horizontal page scroll (only the table containers scroll).

### 11.3 Mock pay page polish (T11, backend-infra-dev)

- `routes/pay.ts` renders all its pages (checkout, already paid, success, not found) with one shared HTML shell: `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, and an inline `<style>` (system font stack, slate background, centred white card with rounded corners and shadow, indigo primary button full-width on phones). It uses no external assets and no `<script>`.
- Checkout card content: the business name (`config.businessName`, so `registerPayRoutes` receives the config), heading `Pay invoice <number>`, client name, a large amount, `Due <YYYY-MM-DD>`, the button `Pay <amount> (mock)`, and the note `Mock checkout. No real payment is taken.` Already paid: the same card with `This invoice is already paid.` and no button. Success: an inline SVG check icon and `<h1>Payment received. Thank you!</h1>`. Not found (404): `Payment link not found`.
- `GET /favicon.svg` returns the brand mark SVG (`image/svg+xml`, the same design as `web/src/app/icon.svg`). `GET /favicon.ico` returns the same SVG body with `image/svg+xml`, so browsers stop logging a 404.
- New test `backend/tests/pay-page.test.ts`: viewport meta, favicon link, `<style>`, business name, the mock note, no `<script` on any pay page, `/favicon.svg` and `/favicon.ico` return 200 with `image/svg+xml`, and the 404 page uses the shell and contains `Payment link not found`.

### 11.4 Demo mode (T12, T13 backend-infra-dev; T14 fullstack-dev)

Demo mode is off by default. With `DEMO_MODE` unset, the app behaves exactly as in phase 1 and existing tests are unchanged.

Config (`config.ts`, each variable also in `.env.example` and `docs/deployment.md`):

| Variable | Default | Meaning |
|---|---|---|
| `DEMO_MODE` | `false` | `true` or `1` turns demo mode on (API and web each read their own) |
| `DEMO_RESET_CHECK_SECONDS` | `900` | how often the API checks whether the daily reset is due |
| `DEMO_WRITE_RATE_LIMIT` | `30` | demo only: write requests per minute per client IP |
| `DEMO_MAX_INVOICES` | `200` | demo only: cap on total invoices |
| `DEMO_MAX_RULES` | `20` | demo only: cap on total rules |
| `TRUST_PROXY` | `false` | `true` makes Fastify trust `X-Forwarded-For` (needed behind Render's proxy so rate limits see client IPs) |
| `DB_CREATE_IF_MISSING` | `false` | `true` makes `server.ts` create the database named in `DATABASE_URL` if it doesn't exist (connects to the `postgres` database first) |
| `DATABASE_SSL` | `false` | T15: `true` passes `ssl: { rejectUnauthorized: false }` to `pg` for hosts that require TLS |

Demo data and daily reset (T12):
- Migration `backend/migrations/003_demo_state.sql`: `demo_state(id integer primary key check (id = 1), last_reset_on date not null, last_reset_at timestamptz not null)`. The migration creates this schema in every database; only demo mode reads or writes the table.
- `src/db/ensure-database.ts`: `ensureDatabase(url)` (same approach as `tests/global-setup.ts`), called by `server.ts` first when `DB_CREATE_IF_MISSING=true`. `docker/db/init/02-create-demo-db.sql` also creates `invoice_reminders_demo` on fresh volumes.
- Extract the import logic from `routes/imports.ts` into `src/sources/import.ts` (`importInvoices(db, source, today)`), so the route and the demo seed share it. The route behaviour is unchanged. `seedDefaultRules` may be widened to accept any `{ query }` client so it can run inside a transaction.
- `src/demo/seed-data.ts` and `src/demo/reset.ts`:
  - `resetDemoData(pool, config, today = todayUtc())` throws `Demo reset refused: DEMO_MODE is off` and runs no query when `config.demoMode` is false. Otherwise, in one transaction holding `pg_advisory_xact_lock(424242)`, it runs `TRUNCATE reminders, invoices, reminder_rules RESTART IDENTITY CASCADE`, seeds the default rules, imports the 4 mock Stripe invoices through `importInvoices`, inserts the manual seed invoices and reminder history below, upserts `demo_state` (`last_reset_on = today`, `last_reset_at = now()`), and returns `{ reset_at, invoices: 9, reminders: 7 }`.
  - `checkAndResetIfStale(pool, config)` returns `false` without touching the pool when demo mode is off. Otherwise it resets when `demo_state` has no row or `last_reset_on < todayUtc()`, and returns whether it reset.
  - `src/demo/resetter.ts` `DemoResetter`: `start()` runs `checkAndResetIfStale` every `DEMO_RESET_CHECK_SECONDS`; `stop()`. In demo mode `server.ts` awaits `checkAndResetIfStale` once before `listen` (this catches the daily reset when a sleeping free-tier instance wakes up), then starts the resetter. Outside demo mode it never constructs or starts the resetter.
- Seed data (dates relative to `today`; `issue_date = due_date - 30`; reminders have `status = 'sent'` and `trigger = 'scheduled'`, `sent_at` is `due_date + offset` days at 09:00 UTC, and subject and body are rendered with the real default templates via `buildTemplateVars(invoice, <sent date>, config)`; nothing is emailed):

| Number | Client | Email | Cents | Due (days from today) | State | Reminder history |
|---|---|---|---|---|---|---|
| STR-1001..STR-1004 | mock fixture (section 6) | | | -3, -12, -35, +7 | unpaid, `source = 'mock_stripe'` | STR-1002 only: Friendly nudge (offset 1) |
| INV-2041 | Harbor & Pine Interiors | ap@harborpine.test | 320000 | -45 | unpaid (overdue) | Friendly nudge (1), Firm reminder (10), Final notice (30) |
| INV-2042 | Maple Street Bakery | owner@maplestreet.test | 65000 | -20 | paid, `paid_via = 'pay_link'`, `paid_at` = due + 12 days 15:00 UTC | Friendly nudge (1), Firm reminder (10) |
| INV-2043 | Kestrel Fitness | billing@kestrelfit.test | 150000 | -9 | paid, `pay_link`, `paid_at` = due + 3 days 15:00 UTC | Friendly nudge (1) |
| INV-2044 | Oakline Legal | finance@oakline.test | 210000 | +14 | unpaid (open) | none |
| INV-2045 | Copperleaf Media | accounts@copperleaf.test | 98000 | -5 | paid, `paid_via = 'manual'`, `paid_at` = due - 2 days 10:00 UTC | none |

  Expected right after a reset: 9 invoices, 7 reminders, 3 rules. `GET /api/stats` = `outstanding_cents 1033000`, `overdue_count 4`, `overdue_cents 733000`, `reminders_sent 7`, `paid_after_reminder_count 2`, `paid_after_reminder_cents 215000`. `runDueReminders(today)` immediately after a reset sends exactly 3 reminders: STR-1001 Friendly nudge, STR-1002 Firm reminder, STR-1003 Final notice.
- `POST /api/demo/reset` is registered only in demo mode (otherwise Fastify's normal 404). It returns `200 { reset_at, invoices, reminders }`. This is the "reset for tests" hook and the web `Reset demo data` button. Tests call `resetDemoData` or the route through `makeApp({ demoMode: true })` against `invoice_reminders_test`; nothing resets `invoice_reminders`.
- `docker-compose.demo.yml` (override file): `api.environment` sets `DEMO_MODE: "true"`, `DATABASE_URL: postgres://postgres:postgres@db:5432/invoice_reminders_demo`, and `DB_CREATE_IF_MISSING: "true"`; `web.environment` sets `DEMO_MODE: "true"`. Nothing else changes.
- Test `backend/tests/demo.test.ts` clears `demo_state` in its own `beforeEach`. It covers: refusal when off (an existing invoice survives), seed counts and stats as above, the 3 sends from `runDueReminders`, an idempotent second reset, `checkAndResetIfStale` (off: a fake pool whose `query` throws is never called; stale: resets; fresh: no reset, so an extra invoice survives), and `POST /api/demo/reset` returning 404 when off and 200 when on.

Demo safety, Outbox API, abuse limits (T13):
- Email: when `demoMode` is true, `createEmailSender` returns `DemoEmailSender` (`src/email/demo.ts`) whatever `EMAIL_PROVIDER` says. It logs one line (`demo mode: email to <to> suppressed: <subject>`), keeps nothing in memory, and resolves. Reminders are still logged in the `reminders` table, so they appear in the Outbox.
- `GET /api/meta` (both modes): `{ demo_mode, email_delivery: "smtp" | "memory" | "suppressed", last_reset_at, next_reset_at }`. Outside demo mode `last_reset_at` and `next_reset_at` are `null` and `demo_state` is not queried. In demo mode `next_reset_at` is the next 00:00 UTC.
- `GET /api/outbox?limit=50` (both modes, limit 1-100, default 50, 400 otherwise): newest first (`sent_at desc, id desc`) array of `{ id, invoice_id, invoice_number, client_name, rule_name, trigger, from_email, to_email, subject, body, pay_url, status, error, sent_at }`. `from_email` is the current `FROM_EMAIL`; `pay_url` comes from the invoice's `pay_token`. It reads only data the API already stores.
- Abuse limits, demo mode only: `@fastify/rate-limit` (a version compatible with Fastify 5) registered with `global: false` and applied to every POST, PUT, PATCH, and DELETE route, including `POST /pay/:token`, at `DEMO_WRITE_RATE_LIMIT` per minute per IP; `POST /api/demo/reset` is limited to 5 per minute. Over the limit the response is `429` with JSON `{"error":"Too many requests. Please wait a minute and try again."}` (check that the status really is 429; the plugin throws what `errorResponseBuilder` returns). GET and OPTIONS are never limited. Fastify `bodyLimit` is 65536 bytes in demo mode. `POST /api/invoices` returns `409 {"error":"Demo limit reached: at most <N> invoices. Use Reset demo data."}` when the count is at or above `DEMO_MAX_INVOICES`, and `POST /api/rules` does the same with `DEMO_MAX_RULES` and `rules`. Fastify `trustProxy` follows `TRUST_PROXY`. In both modes `client_email` is capped at 254 characters; the existing caps stay (number 50, client name 200, rule name 200, subject 500, body 10000).
- Tests: `backend/tests/outbox.test.ts` (send a reminder, then the outbox entry has `to_email`, a subject with the invoice number, a body containing `pay_url`, `pay_url` ending in `/pay/<token>`, and `from_email`; `limit=0` returns 400), `backend/tests/demo-safety.test.ts` (sender factory returns `DemoEmailSender` in demo mode even with `emailProvider: "smtp"`; `/api/meta` in both modes), and `backend/tests/demo-limits.test.ts` (demo with limit 3: the 4th POST returns 429 with `error`, and 10 GETs never return 429; demo off: 10 POSTs all return 201; invoice cap 409 with `Demo limit reached`; a 100 KB body returns 413 in demo mode).

Web (T14):
- `layout.tsx` reads `process.env.DEMO_MODE` on the server at request time (add `export const dynamic = "force-dynamic"` to the root layout so the value isn't frozen at build). Not a `NEXT_PUBLIC_` variable, so one image works for both modes. When it is `true`, a full-width amber banner above the header shows `Demo mode: data resets daily and no real emails are sent.` and a button `Reset demo data` (client component: `POST /api/demo/reset`, then shows `Demo data reset.` and reloads the page data). Both texts are in the SSR HTML in demo mode and absent in normal mode.
- Nav gets a fourth link `Outbox` (`/outbox`), after `Rules`.
- `/outbox` (both modes): heading `Outbox` and the description `Reminder emails sent by the app, newest first.` (both SSR). It reads `GET /api/outbox?limit=50`. Each email is a card with the subject as its title, `To: <to_email>`, `From: <from_email>`, sent time, rule name, a trigger badge, a status badge (`sent`/`failed`), the invoice number linking to `/invoices/[invoice_id]`, the rendered body in a `<pre>` with `whitespace-pre-wrap`, and a plain same-tab link `Open pay link` to `pay_url`. Empty state: `No emails sent yet.`; skeleton cards while loading.
- QA walks acceptance only in normal mode, because it may run only `Start:`/`Stop:`. The banner is therefore checked by `verify` with curl against the demo stack.

### 11.5 Hosting: Render (T15, backend-infra-dev)

Chosen platform: Render, via a Blueprint (`render.yaml` at the repo root).
- Why Render: one file in the repo declares both Docker web services, a managed Postgres database, the wiring of the database connection string into the API (`fromDatabase`), health check paths, and prompted env vars. The user deploys with "New > Blueprint" in the dashboard and runs no CLI. Railway's config-as-code (`railway.json`/`railway.toml`) is per service and its Postgres is added in the dashboard or a template, so it can't come from one repo file. Fly.io uses one `fly.toml` per app, needs `flyctl` to create two apps and a Postgres cluster, and has no free tier. (Platform comparison is from planner knowledge, not checked against current vendor docs.)
- Free-tier caveats (unconfirmed, from planner knowledge; the user should check Render's pricing page): free web services spin down after about 15 minutes without traffic and take up to about a minute to wake; free Postgres databases expire after about 30 days unless upgraded. While the API sleeps, the in-process scheduler and resetter don't run. The startup `checkAndResetIfStale` makes the demo fresh on the first request of a new day, and the dashboard's `Run reminders now` still works.

`render.yaml` (paths relative to the repo root; field names per the Render Blueprint spec as known to the planner, so check https://render.com/docs/blueprint-spec before the first deploy):
- `databases`: `name: invoice-reminders-db`, `databaseName: invoice_reminders`, `user: invoice_reminders`, `plan: free`, `postgresMajorVersion: "16"`, `ipAllowList: []` (no external connections).
- `services[0]`: `type: web`, `name: invoice-reminders-api`, `runtime: docker`, `plan: free`, `dockerContext: ./backend`, `dockerfilePath: ./backend/Dockerfile`, `healthCheckPath: /api/health`, `numInstances: 1` and no `scaling` block (the scheduler and the daily reset run in-process and must run on exactly one instance). `envVars`: `DATABASE_URL` from `fromDatabase: { name: invoice-reminders-db, property: connectionString }`; `DEMO_MODE=true`, `EMAIL_PROVIDER=memory`, `TRUST_PROXY=true`, `TZ=UTC`, `SCHEDULER_INTERVAL_SECONDS=3600`, `BUSINESS_NAME=Demo Studio`, `FROM_EMAIL=Demo Studio <billing@demo-studio.test>`; `PUBLIC_API_URL` and `WEB_ORIGIN` with `sync: false` (prompted at creation).
- `services[1]`: `type: web`, `name: invoice-reminders-web`, `runtime: docker`, `plan: free`, `dockerContext: ./web`, `dockerfilePath: ./web/Dockerfile`, `healthCheckPath: /`. `envVars`: `DEMO_MODE=true`, `NEXT_PUBLIC_API_URL` with `sync: false`.
- Expected values (the onrender.com subdomain equals the service name if it is free, otherwise Render adds a suffix): `PUBLIC_API_URL=https://invoice-reminders-api.onrender.com`, `WEB_ORIGIN=https://invoice-reminders-web.onrender.com`, `NEXT_PUBLIC_API_URL=https://invoice-reminders-api.onrender.com`. As a fallback, when `PUBLIC_API_URL` is unset the API uses `RENDER_EXTERNAL_URL` if present (Render sets it for web services, unconfirmed), then the localhost default.

Production images:
- `backend/Dockerfile`: `node:22-alpine`, `npm ci --omit=dev` (`tsx` is already a runtime dependency), copy `package*.json`, `src/`, `migrations/` with `--chown=node:node`, `ENV NODE_ENV=production`, `USER node`, `EXPOSE 4000`, the same `CMD`. It listens on `$PORT` (Render injects it; default 4000). `backend/.dockerignore` adds `tests`, `coverage`, `*.log`, `.env*`.
- `server.ts` shuts down on SIGTERM and SIGINT: stop the scheduler and resetter, `app.close()`, `pool.end()`, exit 0.
- `web/Dockerfile`: unchanged build stage with `ARG NEXT_PUBLIC_API_URL`. The runtime stage copies with `--chown=node:node` and runs `USER node`. The public API URL is inlined into client JavaScript at build time: locally compose passes it as a build arg; on Render, set `NEXT_PUBLIC_API_URL` on the web service, and Render exposes service env vars to Docker builds as build args (per Render docs as the planner recalls it; confirm on first deploy by checking that the deployed web app calls the right API). Changing it later needs a rebuild of the web service.
- Migrations run at API startup (`runMigrations` before `listen`). They are idempotent through `schema_migrations`; with one instance there is no race, so no pre-deploy command is needed (Render's pre-deploy command is also a paid feature, unconfirmed).
- Health checks: API `/api/health` (checks the DB), web `/`.
- `docs/deployment.md`: an env var reference table for both services (every key in `render.yaml` plus the section 11.4 variables), build-time vs runtime variables, how migrations run, the single-instance scheduler note, free-tier caveats, and how to redeploy the web after changing the API URL.
- Local validation (no real deploy), new backend devDependency `yaml`, test `backend/tests/deploy-config.test.ts`: parses `../render.yaml` and checks two `web` services with `runtime: docker`, existing `dockerfilePath` files and `dockerContext` folders, the health check paths above, API `numInstances: 1` and no `scaling`, `DATABASE_URL` `fromDatabase.name` equal to `databases[0].name` with property `connectionString`, `DEMO_MODE` `"true"` on both services, `EMAIL_PROVIDER` `memory`, the `sync: false` keys present, and every `envVars` key mentioned in `docs/deployment.md` and `.env.example`. It also parses `../docker-compose.demo.yml` and checks the api `DEMO_MODE` and a `DATABASE_URL` ending in `/invoice_reminders_demo`. The verify also builds both production images, checks that they run as non-root, that the API image has no dev dependencies, and that a build-arg API URL appears in the web image's `.next/static`.

### 11.6 Screenshots (T16, fullstack-dev)

- `playwright` in `web` devDependencies (version pinned by the lockfile). The Chromium browser is installed inside the repo with `PLAYWRIGHT_BROWSERS_PATH=0` (it goes under `web/node_modules/playwright-core/.local-browsers`), never into the user profile and never globally. Script `npm run screenshots:install-browser` (`node scripts/install-browser.mjs`, which runs Playwright's CLI `install chromium` with that env var). The developer runs it once in T16; verify never installs anything.
- `web/scripts/screenshots.mjs` (plain Node ESM), run by `npm run screenshots -- [--out <dir>] [--web <url>] [--api <url>]`. Defaults: `--out ../docs/screenshots`, `--web http://localhost:13000`, `--api http://localhost:14000`. It sets `process.env.PLAYWRIGHT_BROWSERS_PATH ??= "0"` before `await import("playwright")`. It exits 1 with `Start the demo stack first: docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --force-recreate --wait` when `GET /api/meta` doesn't report `demo_mode: true`. Then it calls `POST /api/demo/reset` and captures, with headless Chromium, `reducedMotion: "reduce"`, and a 1440x900 viewport unless noted, waiting for the named text before each shot:
  - `dashboard.png` `/` (wait for `$10,330.00`)
  - `invoices.png` `/invoices` (wait for `Harbor & Pine Interiors`)
  - `invoice-detail.png` `/invoices/<id of INV-2041 from GET /api/invoices>` (wait for `Final notice`)
  - `rules.png` `/rules` (wait for `Friendly nudge`)
  - `outbox.png` `/outbox` (wait for `INV-2041`)
  - `pay-page.png`, the `pay_url` of STR-1003 (wait for `Pay invoice STR-1003`)
  - `dashboard-mobile.png` `/` at 390x844 (wait for `$10,330.00`)
- The developer generates the committed `docs/screenshots/*.png` with the default `--out`. Verify writes to the ignored `.poc-artifacts/screenshots/` so QA never modifies tracked files.

### 11.7 README (T17, backend-infra-dev)

`README.md` at the repo root, written for portfolio readers, with these `##` sections in order: `## The problem`, `## Features`, `## Screenshots`, `## Architecture`, `## Tech stack`, `## Run locally`, `## Run the tests`, `## Demo mode`, `## Deploy to Render`, `## Limitations`, `## Next steps`. Above them: the title, a one-paragraph pitch, `Live demo: TODO (add the Render URL after deploying)` and `Demo video: TODO (add the video link)`.
- Problem: cite only the Read-backed figures from `docs/trend-ideas.md` idea #1, each linked to https://clockify.me/late-invoice-statistics: only 52% of B2B invoices paid on time and 5% written off as bad debt; 43% of the value of credit-based B2B sales overdue; US small businesses owed more than $17,000 in overdue invoices; slightly less than a third of freelancer invoices late (the 2026 Bonsai study cited on that page); freelancers spend more than one full workday per month chasing payments. Do not use the unverified Leads (15-30%, $6,000, 70%) or the 38% figure.
- Screenshots: embed `docs/screenshots/dashboard.png`, `invoices.png`, `invoice-detail.png`, `rules.png`, `outbox.png`, `pay-page.png`, `dashboard-mobile.png` with alt text, and show how to regenerate them (demo start, `cd web && npm run screenshots`).
- Architecture: a Mermaid diagram (browser to Next.js web to Fastify API to Postgres; API to the EmailSender (SMTP/Mailpit, or suppressed in demo); scheduler and demo resetter inside the API; MockStripeSource; customer pay page served by the API), plus a short module overview.
- Run locally: prerequisites (Node 20+, Docker Desktop, Git Bash), `npm install` in `backend/` and `web/` for tests and tooling, `Start:`/`Stop:`, URLs (web http://localhost:13000, API http://localhost:14000, Mailpit http://localhost:18025), the demo start command. Tests: `cd backend && npm test` with the stack (or at least `db` and `mailpit`) running, uses `invoice_reminders_test`, plus `npm run typecheck` in both folders.
- Deploy to Render: step by step (push to GitHub; New > Blueprint; pick the repo; fill the 3 prompted URLs; wait for db, api, web; open the web URL and check the banner and `/api/health`; if the onrender.com names differ, update the env vars and redeploy the web service so the API URL is rebuilt into it; free-tier caveats), linking `docs/deployment.md` and `render.yaml`.
- Limitations: no authentication (anyone with the URL can edit demo data), single tenant, mock Stripe import, mock checkout, demo mode suppresses email, the in-process scheduler needs one instance, the rate limit is per IP and best effort. Next steps: auth and multi-tenancy, real Stripe/QuickBooks import, a real email provider behind `EmailSender` (Resend/SES), real Stripe Checkout, SMS for high-value invoices, a background job queue.
- The user records the video and fills in the two TODO links.

### 11.8 Phase 2 verify conventions

- Same tools as section 9, plus `docker build`/`docker run` for the image checks. Don't pass absolute container paths that start with `/` as `docker run` arguments, because Git Bash rewrites them; use paths relative to the image `WORKDIR`.
- Any verify that switches to demo mode ends by running `Start:` (`docker compose up -d --build --force-recreate --wait`) so the stack is back in normal mode. Curl output that needs several greps goes to the ignored `.poc-artifacts/` folder. Verify never writes tracked files.
- Verifies never count rows in `invoice_reminders` (it holds old QA data). Exact counts are checked only right after `POST /api/demo/reset` on the demo database, or in tests on the reset `_test` database.
- QA walks acceptance in normal mode after `Start:`. Acceptance steps create their own data with time-based numbers (`QA-S`, `QA-L`, `QA-K`, `QA-O` plus HHMMSS).

### 11.9 New and changed files (summary)

```
docker-compose.demo.yml   render.yaml   README.md   docs/deployment.md   docs/screenshots/*.png
docker/db/init/02-create-demo-db.sql
backend/migrations/003_demo_state.sql
backend/src/db/ensure-database.ts  backend/src/sources/import.ts  backend/src/email/demo.ts
backend/src/demo/seed-data.ts  backend/src/demo/reset.ts  backend/src/demo/resetter.ts
backend/src/routes/demo.ts (meta, reset)  backend/src/routes/outbox.ts
backend/tests/pay-page.test.ts  demo.test.ts  demo-safety.test.ts  outbox.test.ts  demo-limits.test.ts  deploy-config.test.ts
web/src/components/ui/*.tsx  web/src/components/nav.tsx  web/src/components/demo-banner.tsx  web/src/lib/cn.ts
web/src/app/outbox/page.tsx  web/src/app/icon.svg  web/scripts/screenshots.mjs  web/scripts/install-browser.mjs
```

### 11.10 Task scope (T09-T17, build order)

- **T09** (fullstack-dev): design system components, layout, nav with active state, favicon, Dashboard restyle (section 11.2). All 11.1 literals unchanged.
- **T10** (fullstack-dev): Invoices list, Invoice detail, Rules restyle with empty and loading states (section 11.2). All 11.1 literals unchanged.
- **T11** (backend-infra-dev): pay page shell, styling, and favicon routes (section 11.3). Pay literals unchanged.
- **T12** (backend-infra-dev): demo flag, demo database creation, `demo_state`, seed and daily reset, reset route, compose demo override (section 11.4, "Demo data and daily reset").
- **T13** (backend-infra-dev): demo email suppression, `/api/meta`, `/api/outbox`, rate limits and caps (section 11.4, "Demo safety").
- **T14** (fullstack-dev): demo banner with `Reset demo data`, Outbox page and nav link (section 11.4, "Web"). All 11.1 literals unchanged.
- **T15** (backend-infra-dev): Render Blueprint, production Dockerfiles, graceful shutdown, `DATABASE_SSL`, `docs/deployment.md`, deploy-config test (section 11.5).
- **T16** (fullstack-dev): Playwright screenshot script and committed screenshots (section 11.6).
- **T17** (backend-infra-dev): `README.md` (section 11.7).
