# Deployment (Render)

Platform: Render, deployed from the Blueprint `render.yaml` at the repo root (New > Blueprint, pick the repo, fill the three prompted URLs). Nothing here has been deployed from this repository; the config is validated locally only (`backend/tests/deploy-config.test.ts` plus building both production images).

Items marked **(unverified)** come from memory of Render's docs and pricing, not from checking them. Check https://render.com/docs/blueprint-spec and the pricing page before the first deploy.

## Services

| Service | Type | Notes |
|---|---|---|
| `invoice-reminders-db` | managed Postgres 16 | `ipAllowList: []` means no external connections (unverified field semantics) |
| `invoice-reminders-api` | Docker web service | health check `/api/health`, single instance |
| `invoice-reminders-web` | Docker web service | health check `/` |

## Environment variables: API (`invoice-reminders-api`)

| Variable | Set in render.yaml | Meaning |
|---|---|---|
| `DATABASE_URL` | from the database (`fromDatabase`, `connectionString`) | Postgres connection string |
| `DATABASE_SSL` | `true` | Passes `ssl: { rejectUnauthorized: false }` to `pg`. Local compose leaves it unset (`false`), so local Postgres works without TLS |
| `DEMO_MODE` | `true` | Demo mode: email suppressed, daily data reset, write rate limit, caps |
| `EMAIL_PROVIDER` | `memory` | No SMTP on Render (demo mode suppresses email anyway) |
| `TRUST_PROXY` | `true` | See "Rate limit and TRUST_PROXY" |
| `TZ` | `UTC` | |
| `SCHEDULER_INTERVAL_SECONDS` | `3600` | How often the in-process scheduler runs |
| `BUSINESS_NAME` | `Demo Studio` | |
| `FROM_EMAIL` | `Demo Studio <billing@demo-studio.test>` | |
| `PUBLIC_API_URL` | prompted (`sync: false`) | Public API URL, used in pay links. Must equal the real API URL. If unset, `RENDER_EXTERNAL_URL` is used when present (unverified), then the localhost default |
| `WEB_ORIGIN` | prompted (`sync: false`) | Web app origin for CORS. Must equal the real web URL exactly (scheme and host, no trailing slash) |
| `PORT` | injected by Render | The API listens on `$PORT` (default 4000) |

Other API variables (defaults are fine on Render): `DEMO_RESET_CHECK_SECONDS` (900), `DEMO_WRITE_RATE_LIMIT` (30 writes per minute per IP), `DEMO_MAX_INVOICES` (200), `DEMO_MAX_RULES` (20), `DB_CREATE_IF_MISSING` (false), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (SMTP only).

## Environment variables: web (`invoice-reminders-web`)

| Variable | Set in render.yaml | Meaning |
|---|---|---|
| `DEMO_MODE` | `true` | Read at request time on the server; shows the demo banner |
| `NEXT_PUBLIC_API_URL` | prompted (`sync: false`) | Public API URL. **Build-time**, see below |

## Build-time vs runtime

- `NEXT_PUBLIC_API_URL` is inlined into the client JavaScript when the web image is built (`ARG NEXT_PUBLIC_API_URL` in `web/Dockerfile`). Locally, compose passes it as a build arg. On Render, service env vars are exposed to Docker builds as build args (unverified: confirm on the first deploy that the deployed web app calls the right API).
- Changing `NEXT_PUBLIC_API_URL` later needs a rebuild of the web service: edit the variable, then Manual Deploy > Clear build cache & deploy (or push a commit). A plain restart is not enough.
- `DEMO_MODE` on web is a runtime variable; changing it needs only a restart.
- Expected URLs, if the names are free (otherwise Render adds a suffix, so use the real ones): `PUBLIC_API_URL=https://invoice-reminders-api.onrender.com`, `WEB_ORIGIN=https://invoice-reminders-web.onrender.com`, `NEXT_PUBLIC_API_URL=https://invoice-reminders-api.onrender.com`.

## Rate limit and TRUST_PROXY

Demo mode has an in-process per-IP write rate limit (`DEMO_WRITE_RATE_LIMIT`). Behind Render's proxy, the TCP peer is the proxy, so without `TRUST_PROXY=true` every visitor would share one limit. `render.yaml` sets `TRUST_PROXY=true` so Fastify reads the client IP from `X-Forwarded-For`. Leave it `false` when the API is exposed directly (for example local compose), because clients could then spoof the header.

## Single instance (scheduler and demo reset)

The reminder scheduler and the demo resetter run inside the API process, and the rate limiter keeps its counters in memory. The API therefore must run as exactly one instance: `numInstances: 1` with no `scaling` block (no autoscaling). Two instances would run reminders twice and keep separate rate limits. Moving to several instances would need a job queue or leader election first.

## Migrations

Migrations run at API startup (`runMigrations` before `listen`) and are idempotent through the `schema_migrations` table. With one instance there is no race, so no pre-deploy command is used (Render's pre-deploy command may be paid-only, unverified).

## Graceful shutdown

On SIGTERM or SIGINT the API stops the scheduler and the demo resetter, closes Fastify, ends the pg pool, and exits 0 (forced exit with code 1 after 10 seconds).

## Production images

- API: `node:22-alpine`, `npm ci --omit=dev` (`tsx` is a runtime dependency; `vitest` and `typescript` are dev-only), runs as the `node` user. Contains `src/` and `migrations/` only.
- Web: Next.js standalone output, runs as the `node` user.

## Free-tier caveats (unverified)

- Free web services spin down after about 15 minutes without traffic and take up to about a minute to wake. While the API sleeps, the scheduler and the resetter do not run. On wake-up, startup runs the stale-demo check, so the data is fresh on the first request of a new day.
- Free Postgres databases expire after about 30 days unless upgraded.
- The Render free tier may change; check the pricing page.

## Redeploy checklist

1. Deploy the Blueprint, fill the three prompted URLs.
2. Open the web URL: the demo banner shows, and `<api url>/api/health` returns `"db":"ok"`.
3. If the real onrender.com URLs differ from the expected ones, fix `PUBLIC_API_URL`, `WEB_ORIGIN` and `NEXT_PUBLIC_API_URL`, then redeploy the API and rebuild the web service.
