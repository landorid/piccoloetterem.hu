# Orchestration — how the agent work is driven

One **orchestrator** session drives the whole release. It launches one **worker** session per issue,
babysits that worker's pull request every hour, and launches the next issue only when the previous
one has merged. Decided 2026-09-06; it revises the process bullets in [PLAN.md](PLAN.md) §2.

## Rules

1. **Concurrency 1.** Exactly one worker is in flight at a time. Never launch the next issue while
   an earlier one still has an open PR.
2. **PR per issue.** A worker branches `feat/<key>-<issue>` from `develop`, opens a draft PR into
   `develop`, and marks it ready when acceptance passes.
3. **Never auto-merge.** Neither the worker nor the orchestrator merges anything, ever. Dávid merges
   the PR and GitHub closes the issue via `Closes #<n>`. That merge is the only signal that the next
   issue may start.
4. **Blockers are merge-gated.** An issue is startable only when every issue in its `Blocked by`
   list is *closed* — an open PR does not count.
5. **Manual issues are Dávid's.** Issues labelled `manual` (#39–#43) are never given to a worker.
   The orchestrator only reminds when one becomes unblocked.
6. **#30 needs review.** O2 is a design mockup labelled `needs-review`. Its dependent #34 stays
   blocked until Dávid has approved the mockup, not merely until the PR merged.

## The order

Strict serial order, already checked against every `Blocked by` list. Run top to bottom.

| # | Issue | Key | Blocked by | Notes |
|---|---|---|---|---|
| 1 | #16 | F1 | — | Creates `develop`. Everything waits on it. |
| 2 | #30 | O2 | — | Design mockup. Run early: Dávid's review has latency and #34 needs it. |
| 3 | #17 | F2 | 16 | Unblocks manual #41 on merge. |
| 4 | #18 | F3 | 16 | |
| 5 | #19 | F4 | 16, 18 | |
| 6 | #20 | F5 | 19 | |
| 7 | #21 | F6 | 19 | |
| 8 | #22 | F7 | 19 | Unblocks manual #40 on merge. |
| 9 | #23 | M1 | 17 | |
| 10 | #24 | M2 | 18, 21, 23 | |
| 11 | #25 | M3 | 24 | |
| 12 | #26 | M4 | 20, 21 | |
| 13 | #27 | M5 | 24, 26 | |
| 14 | #28 | M6 | 24, 26 | |
| 15 | #29 | O1 | 23 | |
| 16 | #31 | O3 | 18, 25, 29 | |
| 17 | #32 | O4 | 31 | Unblocks manual #39 on merge. |
| 18 | #33 | O5 | 20, 25 | |
| 19 | #34 | O6 | 29, 30, 33 | Also needs Dávid's sign-off on the #30 mockup. |
| 20 | #35 | O7 | 31, 34 | |
| 21 | #36 | S1 | 31, 21 | |
| 22 | #37 | S2 | 36, 26 | |
| 23 | #38 | S3 | 36, 26 | |

Manual issues to remind Dávid about when their blocker closes: #41 (after #17), #40 (after #22),
#39 (after #32), #43 (after #39), #42 (after #27, #28, #35, #38).

## Launching a worker

The orchestrator posts a task chip; Dávid clicks it and a session opens on its own git worktree.
Set the model to **Opus 5, high reasoning**. The chip prompt must be self-contained — the worker
has none of the orchestrator's context. Template:

> Work GitHub issue #<n> (<key>: <title>) in landorid/piccoloetterem.hu, and only that issue.
>
> Start by reading the full issue body: `gh issue view <n>`. It is written to be self-contained —
> its Scope, Acceptance criteria, Validation, Repo guardrails and Stop conditions are binding.
> Then read `docs/PLAN.md` (decisions and domain model), `docs/STACK.md` (stack rules, Hungarian)
> and `AGENTS.md` if it exists.
>
> Branch `feat/<key>-<n>` from `develop`. Open a **draft PR into `develop`** as soon as you have
> your first commit, body ending `Closes #<n>`. Mark it ready for review when every acceptance
> criterion passes and CI is green. **Never merge it** and never push to `develop` or `main` —
> Dávid merges.
>
> Before pushing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass.
> Do not reopen a decision in PLAN.md §2. If a stop condition in the issue is hit, stop, write what
> you found as an issue comment, and say so — do not guess.
>
> When the PR is ready, comment on the issue with what you built, what you deliberately left out,
> anything surprising, and any follow-up you recommend.

## The hourly heartbeat

Runs in the orchestrator session, once an hour. Each tick, in order:

1. **Merged?** `gh pr list --state merged --limit 5` and `gh issue view <current> --json state`.
   If the current issue is closed and its PR merged → the slot is free, go to step 5.
2. **PR health.** For the open PR: `gh pr checks <n>` (CI), `gh pr view <n> --json reviewDecision,mergeable,comments,reviews`.
   - CI red → tell the worker session which check failed and its log tail.
   - `mergeable: CONFLICTING` → tell the worker to rebase onto `develop`.
   - Unresolved review comments → relay them to the worker.
   Reach the worker with `send_message` to its session. If the worker session is gone, post the
   same instruction as a PR comment and tell Dávid the worker needs relaunching.
3. **Stalled?** No commit on the PR branch and no worker activity for 3 consecutive ticks → report
   it to Dávid rather than silently waiting.
4. **Blocked on Dávid?** PR is ready for review, CI green, no conflicts → say so and stop nagging;
   the merge is his.
5. **Next issue.** Only when no PR is open: take the next row of the order table whose blockers are
   all closed, and post its task chip.
6. **Manual reminders.** Mention any `manual` issue whose blockers just closed.

Never merge. Never push to `develop` or `main`. Never start a second worker.
