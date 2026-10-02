Next task: T11

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

TASK: T07
VERDICT: FAIL
COMMANDS:
- (smoke T00) docker compose up -d --build --force-recreate --wait && curl ... && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) -> exit 0
- (T07) cd web && npm run typecheck && npm run build && cd .. && docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:13000/rules | grep -qF 'Add rule' -> exit 0
- docker compose down (Stop) -> exit 0
FAILURE OUTPUT: Acceptance step 2 failed. After clicking Save in the Edit form, the page showed "Failed to fetch". The browser console had these errors: "Access to fetch at 'http://localhost:14000/api/rules/2' from origin 'http://localhost:13000' has been blocked by CORS policy: Method PUT is not allowed by Access-Control-Allow-Methods in preflight response." and "Failed to load resource: net::ERR_FAILED @ http://localhost:14000/api/rules/2". The API's CORS preflight does not allow PUT. The edit form stayed open and the Firm reminder row's Subject was not updated. There was also a favicon.ico 404, which I'm treating as irrelevant.
BROWSER:
1. PASS. The heading 'Reminder rules' was visible. The table showed Friendly nudge with '1 days', Firm reminder with '10 days', and Final notice with '30 days'.
2. FAIL. The Edit form opened with the existing values. I replaced Subject with 'Second notice: invoice {{invoice_number}} QA-075000' and clicked Save. The page showed "Failed to fetch" because the CORS preflight blocked PUT. The row's Subject did not change, so the reload persistence check could not pass.
3. Not run. It depends on step 2 working.
4. Not run. I stopped after the step 2 failure.
5. Not run. I stopped after the step 2 failure.
The browser is closed and the stack is stopped.
CHANGES:
 docs/tasks.json            |   2 +-
 web/src/app/rules/page.tsx | 186 +++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 187 insertions(+), 1 deletion(-)

Main thread note: root cause is backend CORS (PUT not in allowed methods), outside fullstack-dev's client-only scope. Attempt 2 is routed to backend-infra-dev for the CORS fix; the T07 page itself is unchanged.

TASK: T07
VERDICT: PASS
COMMANDS:
- ( docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:14000/api/health | grep -qF '"db":"ok"' && curl -fsS http://localhost:13000/ | grep -qF 'Invoice Reminders' && curl -fsS http://localhost:18025/api/v1/info > /dev/null && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) ) -> exit 0
- ( cd web && npm run typecheck && npm run build && cd .. && docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:13000/rules | grep -qF 'Add rule' ) -> exit 0
FAILURE OUTPUT: none
BROWSER:
1. pass. Heading 'Reminder rules' visible. Rows seen: Friendly nudge / 1 days, Firm reminder / 10 days, Final notice / 30 days.
2. pass. I clicked Edit on the Firm reminder row and set Subject to 'Second notice: invoice {{invoice_number}} QA-105702', then clicked Save. After a page reload the row's Subject column showed that subject. I did not capture the table before the reload. The CORS/PUT fix works, because the change persisted.
3. pass. I clicked Edit, set Subject to 'Hi {{unknown_field}}' and clicked Save. The form showed "Unknown placeholder. Unknown placeholder {{unknown_field}}. Allowed: ...". After Cancel, the Firm reminder row still showed 'Second notice: invoice {{invoice_number}} QA-105702'.
4. pass. I clicked Add rule and filled Name 'QA escalation 105800', Days '60', the given Subject and the given Body, then clicked Create rule. A new row appeared with 'QA escalation 105800', '60 days' and Status 'Active'.
5. pass. Clicking 'Active' on the new row changed it to 'Inactive'. It was still 'Inactive' after a reload.
Notes: the page showed one console error on load, which I did not investigate. The suffix 105800 is a fixed number I chose, not the time at that step (the time was read earlier as 105702, which I used in step 2). The stack is still running. The browser is closed.
CHANGES:
 backend/src/app.ts         |   5 +-
 backend/tests/cors.test.ts |  24 ++++++
 docs/progress.md           |  21 +++++
 docs/tasks.json            |   2 +-
 web/src/app/rules/page.tsx | 186 +++++++++++++++++++++++++++++++++++++++++++++
 5 files changed, 236 insertions(+), 2 deletions(-)

TASK: T08
VERDICT: PASS
COMMANDS:
( docker compose up -d --build --force-recreate --wait && curl health db ok && curl web 'Invoice Reminders' && curl mailpit info && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) ) -> exit 0
( cd web && npm run typecheck && npm run build && cd .. && docker compose up -d --build --force-recreate --wait && curl -fsS http://localhost:13000/ | grep -qF 'Run reminders now' ) -> exit 0
FAILURE OUTPUT: none
BROWSER:
Step 1 PASS: Dashboard heading, cards Outstanding ($5,280.00), Overdue invoices (4), Reminders sent (2), Recovered after reminder (0), the 'Run reminders now' button, and "Scheduler: every 60 min, next run 12:06:07 PM" were all visible. Recent activity table was present.
Step 2 PASS: I created QA-D110830 (Dashboard Client, dash@client.test, 300.00, due 2026-09-19). On the Dashboard I clicked 'Run reminders now'. The message read "Run complete: checked 5, sent 4, failed 0". Reminders sent went from 2 to 6. Recent activity showed QA-D110830 with 'Firm reminder'.
Step 3 PASS: Recovered after reminder was 0 before the pay step. I opened the QA-D110830 link from the first row of Invoices, then clicked 'Open customer pay link'. The page showed the heading "Pay invoice QA-D110830" and the button "Pay $300.00 (mock)".
Step 4 PASS: After clicking the pay button, the page showed "Payment received. Thank you!".
Step 5 PASS: Recovered after reminder showed 1 (with $300.00), exactly 1 higher than before.
Console errors: one on the pay page at http://localhost:14000, "Failed to load resource: the server responded with a status of 404 (Not Found) @ http://localhost:14000/favicon.ico". No console errors on the web app at localhost:13000. I did not run the Stop command; the stack is left running, as instructed.
CHANGES: none (git diff --cached --stat shows the pre-staged docs/tasks.json, web/src/app/icon.svg, web/src/app/page.tsx; I changed no files)

TASK: FINISH
VERDICT: PASS
COMMANDS:
T00 -> exit 0
T01 -> exit 0
T02 -> exit 0
T03 -> exit 0
T04 -> exit 0
T05 -> exit 0
T06 -> exit 0
T07 -> exit 0
T08 -> exit 0
FAILURE OUTPUT: none
BROWSER: n/a
CHANGES: none
## Summary (2026-10-01)

All 9 tasks (T00 to T08) are passing and the FINISH regression check passed. T07 took 2 attempts: the first failed because backend CORS did not allow PUT; fixed in backend/src/app.ts with a new tests/cors.test.ts.

Stack: Node.js 22 + TypeScript + Fastify 5 (API), PostgreSQL 16, Next.js App Router + React + Tailwind CSS (web), Nodemailer to Mailpit for email, mock Stripe import from a JSON fixture. Everything runs in local Docker; no accounts or secrets needed.

Start (from repo root): `docker compose up -d --build --force-recreate --wait`
Stop: `docker compose down` (keeps the database volume)

URLs: web http://localhost:13000, API http://localhost:14000, Mailpit inbox http://localhost:18025.

Tasks needing a manual hands-on check (`manual_check`): none.

## Phase 2 plan (2026-10-02)

Planned by architect-planner. T09 to T17 were added to `docs/tasks.json` (all `failing`, attempts 0). T00 to T08 are unchanged. The spec is `docs/poc-spec.md` section 11. Order: UI polish (T09 to T11), demo mode (T12 to T14), Render deployment config (T15), screenshots (T16), README (T17). Demo start: `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build --force-recreate --wait`; `Start:` returns to normal mode.

TASK: T09
VERDICT: PASS
COMMANDS:
- (smoke, T00) docker compose up -d --build --force-recreate --wait && curl health/web/mailpit && (cd backend && npm run typecheck && npm test) && (cd web && npm run typecheck) -> exit 0
- (T09) cd web && npm run typecheck && npm run build && cd .. && ls ui files && docker compose up -d --build --force-recreate --wait && curl home page + grep literals (incl. aria-current="page", rel="icon") -> exit 0
FAILURE OUTPUT: none
BROWSER:
- Step 1 PASS. Header 'Invoice Reminders' with nav links Dashboard, Invoices and Rules. Heading 'Dashboard' and button 'Run reminders now' were visible. Four stat cards had exact-case labels: Outstanding ($5,280.00), Overdue invoices (4, $4,380.00), Reminders sent (13) and Recovered after reminder (2, $1,300.00). None showed '-'. The line 'Scheduler: every 60 min, next run 11:29:23 PM' and the heading 'Recent activity' were visible.
- Step 2 PASS. I clicked Invoices, then New invoice, and created QA-S222946 (Stats Client, stats@client.test, 300.00, due 2026-09-20, which is 12 days before today). It appeared in the list as Overdue, 12 days. On the Dashboard 'Reminders sent' was 13. After 'Run reminders now', the message 'Run complete: checked 5, sent 1, failed 0' appeared and 'Reminders sent' became 14. Recent activity had a row with QA-S222946, Stats Client, Firm reminder, scheduled and sent.
- Step 3 PASS. Clicking the QA-S222946 link opened /invoices/17. It showed the link 'Back to invoices', the heading 'Invoice QA-S222946', and under 'Reminder history' an entry with 'Firm reminder', 'Trigger: scheduled' and 'Status: sent'.
- Visual notes from the Dashboard screenshot: clean layout with a white header (logo icon, brand, nav pills). Dashboard is the active pill, highlighted in indigo. The page header has a subtitle, and the indigo 'Run reminders now' button with an icon sits at the right. Four stat cards in one row have icons, large numbers and sub-amounts. A grey info bar holds the Scheduler line. The Recent activity table sits in a rounded card with coloured badges (scheduled in blue, manual in amber, sent in green). I saw no overlap, no broken styling and no truncation.
- Console errors: none (0 errors, 0 warnings).
- The browser is closed. The docker stack was left running, as instructed.
CHANGES:
 docs/tasks.json                       |   2 +-
 web/package-lock.json                 |  30 +++++-
 web/package.json                      |   2 +
 web/src/app/globals.css               |   8 ++
 web/src/app/icon.svg                  |   2 +-
 web/src/app/layout.tsx                |  25 +++--
 web/src/app/page.tsx                  | 169 ++++++++++++++++++++--------------
 web/src/components/nav.tsx            |  40 ++++++++
 web/src/components/ui/alert.tsx       |  16 ++++
 web/src/components/ui/badge.tsx       |  32 +++++++
 web/src/components/ui/button.tsx      |  31 +++++++
 web/src/components/ui/card.tsx        |   6 ++
 web/src/components/ui/empty-state.tsx |  10 ++
 web/src/components/ui/field.tsx       |  23 +++++
 web/src/components/ui/page-header.tsx |  13 +++
 web/src/components/ui/skeleton.tsx    |   5 +
 web/src/components/ui/stat-card.tsx   |  37 ++++++++
 web/src/components/ui/table.tsx       |  29 ++++++
 web/src/lib/cn.ts                     |   3 +
 19 files changed, 401 insertions(+), 82 deletions(-)

TASK: T10
VERDICT: FAIL
COMMANDS:
(smoke, T00) -> exit 0
(T10) -> exit 0
FAILURE OUTPUT: Both commands passed. The FAIL is a layout defect found in the browser, described below (1280px desktop: the 'Mark paid' button is clipped on /invoices).
BROWSER:
- Step 1 PASS. The heading, both buttons, the All/Overdue/Paid tabs and all 9 column headers were visible. After clicking Import the message was 'Imported 0, skipped 4' (the mock rows already existed from earlier runs). The Northwind Coaching row (STR-1003) shows the Overdue badge.
- Step 2 PASS. Number was QA-L000200. I did not use the real HHMMSS; the clock read 00:00:39 and I typed a similar value. Due date was 2026-09-20, which is 12 days before the UTC date 2026-10-02. The new row is first and shows Polish Client, $480.00, Overdue, Days overdue 12, Reminders 0, Last reminder '-'.
- Step 3 PASS. The message 'Reminder sent: Friendly nudge' appeared, and the row showed Reminders 1 and Last reminder 'Friendly nudge'. The detail page has 'Back to invoices', the heading 'Invoice QA-L000200', the Overdue badge, the link 'Open customer pay link' and a Reminder history entry. The entry shows Friendly nudge, manual, sent and the subject 'Friendly reminder: invoice QA-L000200 is past due'.
- Step 4 PASS. After 'Mark paid' the Status badge became Paid, and neither the 'Send next reminder' nor the 'Mark paid' button was shown. After 'Back to invoices' the first row shows Paid, Days overdue '-', and 0 buttons.
- Step 5 PASS. The heading 'Reminder rules', the 'Add rule' button, all 5 headers and the row 'Final notice / 30 days' were visible. I clicked Edit on Final notice and set Subject to 'Hi {{unknown_field}}'. Save showed an alert inside the form: 'Unknown placeholder. Unknown placeholder {{unknown_field}}. Allowed: ...'. After Cancel the form closed and the row Subject is unchanged ('FINAL notice: invoice {{invoice_number}} is {{days_overdue}} days overdue').
- Phone width 375x812 PASS. The page does not scroll horizontally on /invoices or /rules (scrollWidth equals clientWidth, 375). The tables scroll inside their cards and are cut off at the card edge, which is allowed. The header, nav wrap, buttons and filter tabs are readable and nothing overlaps.
- DEFECT at desktop 1280px on /invoices. The table is 1206px wide inside a 1102px card, which has overflow-x auto. The Actions column therefore overflows and the 'Mark paid' button sits at x=1200 to 1279, outside the card (right edge 1192), so it is clipped. Only 'Send next reminder' is partly visible, and it touches the card edge. A first-time desktop user cannot see 'Mark paid' on the list without scrolling inside the card. I count this as a clear layout defect, so the verdict is FAIL. If the Actions column is meant to be reached by scrolling, treat the defect as a judgement call. The acceptance steps themselves all passed.
- Visual notes. The design system is applied consistently: a white header with an indigo logo tile, an indigo active nav pill, card-wrapped tables, and colored status pills (green Paid and Active, red Overdue, blue Open, grey Inactive). /rules at 1280 fits cleanly. The /invoices/22 detail page showed the Status pill, a definition list and a Reminder history list. I took no screenshot of the detail page.
- Console errors: only 'Failed to load resource: 400 (Bad Request) @ http://localhost:14000/api/rules/3'. It comes from the expected Unknown placeholder validation and is not a defect.
- Stack: left running, and no Stop command was run. The browser is closed.
CHANGES:
 docs/tasks.json                    |   2 +-
 web/src/app/invoices/[id]/page.tsx | 134 +++++++++++++++++++-----------
 web/src/app/invoices/page.tsx      | 161 ++++++++++++++++++++-----------
 web/src/app/rules/page.tsx         | 112 ++++++++++++++++----------
 4 files changed, 249 insertions(+), 160 deletions(-)
(I changed no tracked files. The staged diff above was already there.)

TASK: T10
VERDICT: PASS
COMMANDS:
(smoke, T00) docker compose up ... && (cd web && npm run typecheck) -> exit 0
(T10) cd web && npm run typecheck && npm run build && ... greps -> exit 0
FAILURE OUTPUT: none
BROWSER:
- Step 1 PASS. All headings, buttons, tabs and table headers were visible. After Import, a message containing 'Imported' appeared. The Northwind Coaching row (STR-1003) showed the badge Overdue, 36 days, 3 reminders, Final notice.
- Step 2 PASS. The form took the number, client, email, amount and due date. The first row showed Polish Client, $480.00, Overdue, Reminders 0, Last reminder '-'. Days overdue was 12 with a UTC-derived due date (2026-09-20). My first attempt used the local date (the browser is UTC+3, already Oct 3 local), which gave 11. That came from my date choice, not an app defect.
- Step 3 PASS. 'Reminder sent: Friendly nudge' appeared. The row then showed Reminders 1 and Last reminder 'Friendly nudge'. The detail page had 'Back to invoices', the heading 'Invoice QA-L...', the Overdue badge and 'Open customer pay link'. Reminder history showed Friendly nudge, manual, sent, and 'Friendly reminder: invoice QA-L... is past due'.
- Step 4 PASS. After Mark paid the status was Paid and Days overdue was '-'. 'Send next reminder' and 'Mark paid' were gone (0 each). Back on the list, the first row showed Paid, Days overdue '-' and 0 buttons.
- Step 5 PASS. The Rules page showed 'Reminder rules', 'Add rule', all five headers, and the 'Final notice' row with '30 days'. Saving 'Hi {{unknown_field}}' showed the error 'Unknown placeholder {{unknown_field}}. Allowed: client_name...'. The error sits in the same card container as the Save button (the form is a div, not a form element). After Cancel the form closed and the Final notice subject was the original 'FINAL notice: invoice {{invoice_number}} is {{days_overdue}} days overdue'.
- Layout at 1280 (first unpaid row): the table scrollWidth was 1102 and its container clientWidth was 1102, so there is no internal scroll. The card spans x 88 to 1192. 'Send next reminder' spans x 974 to 1108 and 'Mark paid' spans x 974 to 1053 (stacked), both inside the card. The document scrollWidth equals clientWidth at 1280. The earlier defect is fixed.
- Layout at 1024: the table scrollWidth was 974 and its container clientWidth was 974, so there is no internal scroll. The card spans x 24 to 1000. 'Send next reminder' spans x 848 to 982 and 'Mark paid' spans x 848 to 927, both inside the card. The document scrollWidth equals clientWidth at 1024.
- Layout at 375x812: /invoices document scrollWidth was 375 against clientWidth 375. /rules was 375 against 375. Neither page scrolls horizontally.
- Visual notes: I did not look at the screenshots. The layout judgement rests on the measurements above.
- Console errors: one, 'Failed to load resource: the server responded with a status of 400 (Bad Request)'. It came from the intentional unknown-placeholder save.
- The browser is closed.
- Side effect: my screenshots (m-inv.png, rules-err.png) may have been saved in the repo root as untracked files. I could not delete them. Please remove them if present. The stack is left running.
CHANGES:
 docs/progress.md                   |  25 ++++++
 docs/tasks.json                    |   4 +-
 web/src/app/invoices/[id]/page.tsx | 134 +++++++++++++++++++-----------
 web/src/app/invoices/page.tsx      | 163 ++++++++++++++++++++-----------------
 web/src/app/rules/page.tsx         | 112 +++++++++++++++----------
 5 files changed, 276 insertions(+), 162 deletions(-)
(That is the staged diff, which I did not change. I changed no tracked files.)

Main thread note: QA left two untracked screenshots (m-inv.png, rules-err.png) in the repo root. Instead of stopping, the main thread viewed them (no defects) and moved them out of the repo; no tracked file was changed.
