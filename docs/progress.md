Next task: T01

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
