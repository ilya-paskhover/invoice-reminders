---
name: poc-rules
description: Shared rules for the POC team agents (task list, statuses, blockers, dependencies, git, secrets). Preloaded by those agents; not needed for other work.
user-invocable: false
---

# POC team rules

## Task list
- `docs/tasks.json` is the source of truth for task status. Each task has `id`, `name`, `agent`, `verify` (one non-interactive terminal command that exits 0 on success), `acceptance` (user-visible steps, web UI tasks only), `manual_check` (true for mobile UI tasks), `status`, and `attempts`.
- Status values are `failing` (the default), `implemented`, and `passing`. A developer agent may set only `implemented`. Only the main thread sets `passing`, `failing`, and `attempts`, and only from a QA report. Nobody edits `id`, `name`, `agent`, `verify`, or `acceptance` after planning.
- `docs/progress.md` is the readable log. Its first line is `Next task: <id>`.

## Tests
- You may add tests. Never delete, skip, or weaken an existing test, and never change a `verify` command to make a task pass.

## Blockers
- When you cannot continue, write the cause to `docs/blockers.md` if you have a write tool, then reply with one line starting `BLOCKED:` and stop. An agent without a write tool only replies `BLOCKED:`; the main thread writes the file.
- Circuit breaker: when the same command fails twice in a row with the same final error line, that is a blocker.

## Safety
- Never delete data, drop databases (tests may reset the test database the spec names), deploy to real cloud or Supabase projects, or change anything outside this repository. Use local Docker only. If a task seems to need one of these, reply with one line starting `NEEDS-APPROVAL:` and stop.
- Install dependencies only inside the repository: a Python virtual environment in the path the spec names, and local `node_modules`. Never install globally (no `pip install` outside the venv, no `npm install -g`).
- Subagents never run git commands that change state (commit, push, reset, restore, stash, switch, checkout). Only the main thread commits, and only on the POC branch. Nobody pushes.
- Commit check, run by the main thread before every commit: after staging, if any name in `git diff --cached --name-only` matches `.env*` (except `.env.example`), `*.pem`, or `*secret*`, unstage it, write a blocker, and stop.
- Never read, print, or create files matching `.env*` (except `.env.example`), `*.pem`, or `*secret*`, or anything under `~/.ssh/`. The app may load `.env` at runtime; the user creates it.

## Context hygiene
- From build, test, and server output, read only the last 50 lines or the error lines found with grep, never whole logs.
