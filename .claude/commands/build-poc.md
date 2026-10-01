---
description: Build or resume a POC with the POC team agents
argument-hint: "[idea number | \"idea text\"] [--replan]"
disable-model-invocation: true
---

Input is $ARGUMENTS. A number selects that idea from `docs/trend-ideas.md`; other text is the idea itself; `--replan` forces a new plan. Run one agent at a time, and wait for each agent's result before the next step.

## Preflight
1. Read `.claude/skills/poc-rules/SKILL.md` and follow it.
2. If `docs/blockers.md` exists and is not empty, show it and ask me whether it is resolved. If yes, rename it to `docs/blockers-<YYYYMMDD-HHMM>.md`; it goes into the next commit as a record of the stop. If no, stop.
3. If the working tree has uncommitted changes other than `docs/trend-ideas.md`, show `git status --short` and ask me how to proceed. An uncommitted `docs/trend-ideas.md` is expected; it goes into the plan commit.
4. Work on the branch `poc/<slug>`. When resuming, take the slug from `docs/poc-spec.md`; when planning, derive a short kebab-case slug from the idea. If the branch doesn't exist, create it from the current branch. Never push.
5. If `docs/tasks.json` exists and `--replan` was not given, resume: if T00 is `passing`, run its `verify` as a smoke test (if it fails, write a blocker and stop). Then continue the loop at the task named on the first line of `docs/progress.md`.
6. Otherwise plan. If no idea was given, ask me for one. If planning files already exist, rename each with a `-<YYYYMMDD-HHMM>` suffix. Use architect-planner with the idea and the slug. Show me the chosen stack, the task list, and the `Start:` and `Stop:` commands, and wait for my go-ahead. Then stage with `git add -A`, run the commit check, and commit: `git commit -m "poc(<slug>): plan"`.

## Loop
For each task in `docs/tasks.json` order whose status is not `passing`:

a. Use the task's assigned agent with only that task: its id, name, verify, acceptance, the relevant part of `docs/poc-spec.md`, and QA's last report if the task failed before.
b. If the reply starts with `BLOCKED:` or `NEEDS-APPROVAL:`, or `docs/blockers.md` is not empty, stop and show me why. If the reply is marked partial because the agent hit its turn limit, or doesn't end with `VERIFY: exit 0`, treat it as a FAIL in step f.
c. Stage everything: `git add -A`.
d. Use qa-tester-reviewer with the task, its `acceptance` steps, and two `verify` commands to run: T00's (the smoke test; skip it when the task is T00) and the task's own.
e. Confirm QA changed nothing: `git diff --name-only` and `git ls-files --others --exclude-standard` must both print nothing. Otherwise write a blocker listing the changed files and stop.
f. Check QA's report: it starts with `TASK: <id>`, has the `VERDICT`, `COMMANDS`, `FAILURE OUTPUT`, `BROWSER`, and `CHANGES` fields in that order, every `COMMANDS` line ends in `-> exit <code>`, and nothing follows `CHANGES`. If it doesn't, ask QA once to resend it in the format (continue the same QA agent if you can, otherwise run QA again). If it still doesn't match, append it with the note `Malformed report, treated as FAIL` and treat the verdict as FAIL. Otherwise append it to `docs/progress.md` exactly as returned. Then act on the verdict:
   - PASS: set the task to `passing`, update `Next task:`, run `git add -A`, run the commit check, and commit: `git commit -m "poc(<slug>): <id> passing"`.
   - FAIL: set the task to `failing` and add 1 to `attempts`. At 3 attempts, write a blocker and stop. Otherwise go back to step a for this task.
   - BLOCKED: write QA's reason to `docs/blockers.md` and stop.

## Finish
When every task is `passing`, use qa-tester-reviewer once with the task id `FINISH` and every task's `verify` command, in order, as a final regression check, and check its report as in step f. If it isn't PASS, write the report to `docs/blockers.md` and stop. Otherwise run the `Stop:` command, append a summary to `docs/progress.md` (the stack, how to start and stop the app, and the tasks with `manual_check` that need my hands-on check), stage it, run the commit check, commit it, and show me the summary. Do not push.
