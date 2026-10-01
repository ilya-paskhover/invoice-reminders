Next task: T07

# Progress: invoice-reminders

Plan written 2026-10-01 by architect-planner.

- Stack: Node.js 22 + TypeScript + Fastify API, PostgreSQL 16, Next.js + React + Tailwind CSS web client, Mailpit as the local email catcher, all in Docker Compose.
- Start: `docker compose up -d --build --force-recreate --wait`
- Stop: `docker compose down`
- Spec: `docs/poc-spec.md`. Tasks: `docs/tasks.json` (T00 to T08, all `failing`).

## Log

TASK: T00
VERDICT: PASS
COMMANDS:
- docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:14000/api/health | grep -qF '"db":"ok"' && curl -fsS http://localhost:13000/ | grep -qF 'Invoice Reminders' && curl -fsS http://localhost:18025/api/v1/info > /dev/null && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) -> exit 0
- docker compose down (Stop command from docs/poc-spec.md) -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES:
 .env.example                         |   19 +
 .gitignore                           |   19 +
 backend/.dockerignore                |    4 +
 backend/Dockerfile                   |    8 +
 backend/migrations/001_init.sql      |    2 +
 backend/package-lock.json            | 2863 ++++++++++++++++++++++++++++++++++
 backend/package.json                 |   28 +
 backend/src/app.ts                   |   19 +
 backend/src/config.ts                |   32 +
 backend/src/dates.ts                 |    3 +
 backend/src/db/migrate.ts            |   36 +
 backend/src/db/pool.ts               |   12 +
 backend/src/email/types.ts           |    3 +
 backend/src/routes/health.ts         |   13 +
 backend/src/server.ts                |   25 +
 backend/tests/global-setup.ts        |   29 +
 backend/tests/health.test.ts         |   19 +
 backend/tests/helpers.ts             |   42 +
 backend/tsconfig.json                |   14 +
 backend/vitest.config.ts             |   10 +
 docker-compose.yml                   |   78 +
 docker/db/init/01-create-test-db.sql |    1 +
 docs/tasks.json                      |    2 +-
 web/.dockerignore                    |    4 +
 web/Dockerfile                       |   25 +
 web/next.config.ts                   |    7 +
 web/package-lock.json                | 1692 ++++++++++++++++++++
 web/package.json                     |   25 +
 web/postcss.config.mjs               |    7 +
 web/public/.gitkeep                  |    0
 web/src/app/globals.css              |    1 +
 web/src/app/layout.tsx               |   27 +
 web/src/app/page.tsx                 |    3 +
 web/src/css.d.ts                     |    1 +
 web/src/lib/api.ts                   |   15 +
 web/src/lib/format.ts                |   11 +
 web/tsconfig.json                    |   21 +
 37 files changed, 5119 insertions(+), 1 deletion(-)

TASK: T01
VERDICT: PASS
COMMANDS:
(smoke, T00) docker compose up -d --build --force-recreate --wait && curl ... && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) -> exit 0
(T01) docker compose up -d --force-recreate --wait db && cd backend && npm run typecheck && npm test -- tests/invoices.test.ts tests/import.test.ts -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES: none (git diff --cached --stat, as printed:)
 backend/migrations/002_schema.sql                  |  45 +++++++
 backend/src/app.ts                                 |   5 +
 backend/src/db/seed.ts                             |  32 +++++
 backend/src/routes/imports.ts                      |  38 ++++++
 backend/src/routes/invoices.ts                     | 145 ++++++++++++++++++++
 backend/src/server.ts                              |   2 +
 .../src/sources/fixtures/mock-stripe-invoices.json |   6 +
 backend/src/sources/mock-stripe.ts                 |  40 ++++++
 backend/src/sources/types.ts                       |  15 +++
 backend/tests/helpers.ts                           |   3 +-
 backend/tests/import.test.ts                       |  32 +++++
 backend/tests/invoices.test.ts                     | 148 +++++++++++++++++++++
 docs/tasks.json                                    |   2 +-
 13 files changed, 511 insertions(+), 2 deletions(-)

TASK: T02
VERDICT: PASS
COMMANDS:
- (docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:14000/api/health | grep -qF '"db":"ok"' && curl -fsS http://localhost:13000/ | grep -qF 'Invoice Reminders' && curl -fsS http://localhost:18025/api/v1/info > /dev/null && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck)) -> exit 0
- (docker compose up -d --force-recreate --wait db && cd backend && npm run typecheck && npm test -- tests/templates.test.ts tests/rules.test.ts) -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES:
 backend/src/app.ts                 |  2 +
 backend/src/reminders/templates.ts | 64 +++++++++++++++++++++++++
 backend/src/routes/rules.ts        | 84 +++++++++++++++++++++++++++++++++
 backend/tests/rules.test.ts        | 97 ++++++++++++++++++++++++++++++++++++++
 backend/tests/templates.test.ts    | 55 +++++++++++++++++++++
 docs/tasks.json                    |  2 +-
 6 files changed, 303 insertions(+), 1 deletion(-)

TASK: T03
VERDICT: PASS
COMMANDS:
- (docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:14000/api/health | grep -qF '"db":"ok"' && curl -fsS http://localhost:13000/ | grep -qF 'Invoice Reminders' && curl -fsS http://localhost:18025/api/v1/info > /dev/null && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck)) -> exit 0
- (docker compose up -d --build --force-recreate --wait && cd backend && npm run typecheck && npm test -- tests/reminders.test.ts tests/scheduler.test.ts tests/smtp-mailpit.test.ts && curl -fsS http://localhost:14000/api/scheduler | grep -qF '"interval_seconds":3600') -> exit 0
- git diff --cached --stat -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES:
 backend/src/app.ts                 |   8 ++
 backend/src/email/index.ts         |  14 +++
 backend/src/email/memory.ts        |  18 ++++
 backend/src/email/smtp.ts          |  32 +++++++
 backend/src/reminders/engine.ts    | 161 ++++++++++++++++++++++++++++++++++
 backend/src/reminders/scheduler.ts |  58 +++++++++++++
 backend/src/routes/reminders.ts    |  55 ++++++++++++
 backend/src/routes/scheduler.ts    |   6 ++
 backend/src/server.ts              |  14 ++-
 backend/tests/reminders.test.ts    | 173 +++++++++++++++++++++++++++++++++++++
 backend/tests/scheduler.test.ts    |  51 +++++++++++
 backend/tests/smtp-mailpit.test.ts |  29 +++++++
 docs/tasks.json                    |   2 +-
 13 files changed, 612 insertions(+), 9 deletions(-)

TASK: T04
VERDICT: PASS
COMMANDS:
(smoke, T00) docker compose up -d --build --force-recreate --wait && curl health/web/mailpit checks && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) -> exit 0
(T04) docker compose up -d --build --force-recreate --wait && cd backend && npm run typecheck && npm test -- tests/pay.test.ts tests/stats.test.ts && curl /api/stats | grep -qF '"paid_after_reminder_count"' && curl /pay/no-such-token | grep -qx 404 -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES: (output of git diff --cached --stat)
 backend/src/app.ts          |  4 ++
 backend/src/routes/pay.ts   | 89 +++++++++++++++++++++++++++++++++++++++++++++
 backend/tests/pay.test.ts   | 63 ++++++++++++++++++++++++++++++++
 backend/tests/stats.test.ts | 61 +++++++++++++++++++++++++++++++
 docs/tasks.json             |  2 +-
 5 files changed, 218 insertions(+), 1 deletion(-)

TASK: T05
VERDICT: PASS
COMMANDS:
- ( docker compose up -d --build --force-recreate --wait && curl health/web/mailpit checks && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) ) -> exit 0
- ( cd web && npm run typecheck && npm run build && cd .. && docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:13000/invoices | grep -qF 'Import from Stripe (mock)' ) -> exit 0
FAILURE OUTPUT: none
BROWSER:
1. pass. The heading 'Invoices' and the buttons 'Import from Stripe (mock)' and 'New invoice' are visible. The page also has All, Overdue and Paid filter tabs.
2. pass. After the click, the message 'Imported 0, skipped 4' appeared. The table has a row for Client 'Northwind Coaching' with Status 'Overdue' (35 days).
3. pass. I filled the form with Number QA-103053, Client name 'QA Client', Client email 'qa@client.test', Amount 480.00 and Due date 2026-09-19. Today is 2026-10-01, so 12 days before is 2026-09-19. After 'Create invoice', the first row read QA-103053, QA Client, $480.00, Overdue, Days overdue 12.
4. pass. I clicked 'Mark paid' in the first row. Its Status became 'Paid' and Days overdue became '-'. The row no longer showed the 'Mark paid' or 'Send next reminder' buttons (the Actions cell was empty). I clicked the button through a DOM click on the first row's second button, because I did not take a fresh snapshot ref for it.
5. pass. After clicking the 'Paid' filter tab, the table showed only QA-103053 with Status 'Paid'. No row showed 'Overdue'.
Console: there were 404 errors for /rules, /invoices/<id> RSC prefetches and favicon.ico. They come from pages that later tasks will build and were not part of the acceptance steps.
CHANGES: docs/tasks.json | 2 +-
 web/src/app/invoices/page.tsx | 224 ++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 225 insertions(+), 1 deletion(-)

TASK: T06
VERDICT: PASS
COMMANDS:
- ( docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:14000/api/health | grep -qF '"db":"ok"' && curl -fsS http://localhost:13000/ | grep -qF 'Invoice Reminders' && curl -fsS http://localhost:18025/api/v1/info > /dev/null && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) ) -> exit 0
- ( cd web && npm run typecheck && npm run build && cd .. && docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:13000/invoices/1 | grep -qF 'Back to invoices' ) -> exit 0
FAILURE OUTPUT: none
BROWSER:
- Step 1 PASS: Created QA-R104130 (Reminder Client, reminder@client.test, 250.00, due 2026-09-19, which is 12 days before 2026-10-01). First row showed that Number with Reminders 0 and Last reminder "-". The time suffix was 104130, taken when I filled the form rather than the earlier clock read.
- Step 2 PASS: Clicking 'Send next reminder' showed "Reminder sent: Friendly nudge". First row then showed Reminders 1 and Last reminder "Friendly nudge".
- Step 3 PASS: The Number link opened /invoices/10 with heading "Invoice QA-R104130" and the link "Open customer pay link". Reminder history had exactly one entry: Friendly nudge, Trigger: manual, Subject: "Friendly reminder: invoice QA-R104130 is past due".
- Step 4 PASS: Mailpit listed a message to reminder@client.test with subject "Friendly reminder: invoice QA-R104130 is past due".
- Step 5 PASS: Clicking 'Send next reminder' on the detail page showed "Reminder sent: Firm reminder". Reminder history then had two entries, with "Firm reminder" on top (subject "Reminder: invoice QA-R104130 is 12 days overdue") and Friendly nudge below it. The browser is closed.
- Note: the page console showed 1 to 2 errors during the walk. I did not investigate them and none affected the acceptance steps.
- The stack was left running after the commands, as instructed. I did not run the Stop command because none was specified in this task.
CHANGES:
 docs/tasks.json                    |   4 +-
 web/src/app/invoices/[id]/page.tsx | 149 +++++++++++++++++++++++++++++++++++++
 web/src/app/invoices/page.tsx      |  16 +++-
 3 files changed, 166 insertions(+), 3 deletions(-)
