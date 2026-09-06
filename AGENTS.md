# AGENTS.md — how to work in this repository

Online lunch ordering for one restaurant in Szombathely (Piccolo Club Étterem). Guests browse the
weekly menu and order without an account; staff publish the menu and process the orders. This is a
greenfield rewrite of the CodeIgniter app in `ci_piccolo/` — **reference only, git-ignored, never
copy its implementation and never modify it**. Nothing is migrated from the old database.

Read this file first, then the issue you were given. The issue is written to be self-contained and
its Scope, Non-goals, Acceptance criteria, Validation, Repo guardrails and Stop conditions are
binding.

## Documents

| Document | Holds | Language |
|---|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Every decision, the domain model, the issue plan. §2 is closed — do not reopen it. | English |
| [docs/STACK.md](docs/STACK.md) | The technology choices and §6, the rules that must not be broken. | Hungarian |
| [docs/LEGACY-INVENTORY.md](docs/LEGACY-INVENTORY.md) | What the old system does, feature by feature. | English |
| [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md) | How issues are launched, babysat and merged. | English |

## Layout

| Path | What | Served at |
|---|---|---|
| `apps/web` | Astro + React island — public ordering page | `/` (`/megrendeles`) |
| `apps/admin` | Vite + React + shadcn/ui — staff SPA | `/admin/*` |
| `apps/api` | Hono on Cloudflare Workers; also serves both static builds | `/api/*` |
| `packages/core` | Domain logic, `RestaurantConfig`, pure TypeScript, fully unit-tested | — |
| `packages/db` | Drizzle schema, migrations, `createDb()` | — |
| `packages/api-client` | Typed client from Hono RPC, used by both apps | — |
| `docs/` | The documents above | — |

Everything ships as **one Worker per customer**: static assets and the API on a single origin, so
there is no CORS, no `SameSite=None` and no per-customer DNS step (docs/STACK.md §1).

The workspace packages are consumed as **TypeScript source** (`exports` points at `src/index.ts`);
every consumer — Vite, Astro, Wrangler, Vitest — bundles them. `pnpm build` in a package emits
declarations to `dist/` and is what proves the package compiles on its own.

## Commands

Node 22 (`.nvmrc`), pnpm 9 (pinned in `package.json` via `packageManager`; pnpm 10+ and Corepack
both honour it, so `pnpm i` uses the right version by itself).

```bash
pnpm i                 # install the whole workspace
pnpm dev               # builds the packages, then runs api + web + admin concurrently
pnpm typecheck         # tsc per package; astro check for apps/web
pnpm lint              # biome check .
pnpm format            # biome check --write .
pnpm test              # vitest run, across every workspace project
pnpm build             # packages first, then apps
```

`pnpm dev` serves the API on <http://localhost:8787> (`/api/health` → `{"ok":true}`), the public
site on <http://localhost:4321> and the admin on <http://localhost:5173/admin/>.

Run a single workspace with `pnpm --filter @piccolo/core <script>` and a single Vitest project with
`pnpm exec vitest run --project=@piccolo/core`.

## Branch policy

- `develop` is the integration branch. `main` is production.
- Every issue is built on its own branch, `feat/<key>-<issue number>`, cut from `develop`
  (e.g. `feat/f3-18`).
- **Agents never push to `develop` or `main`** and never merge anything. Work lands through a pull
  request into `develop` that **Dávid** merges; GitHub closes the issue via `Closes #<n>`.
- Open a **draft PR into `develop`** as soon as you have your first commit: title `<key>: <what>`,
  body ending with `Closes #<this issue>`. Mark it ready for review once every acceptance criterion
  passes and CI is green (CI arrives in #22 — until then there is no CI: validate locally and
  paste the output in the closing note).
- Keep the PR mergeable: rebase onto `develop` when it falls behind, keep CI green, and answer
  review comments on the PR.
- Commit messages: `<key>: <what>`, e.g. `F3: add Drizzle schema`.
- Do not start an issue whose blockers are still open — a blocker counts as done only when its PR
  is merged into `develop` and the issue is closed.

## Repo guardrails

- Branch: create `feat/<key>-<issue number>` from `develop` (e.g. `feat/f3-18`). Never commit to
  `develop` or `main`. Commit messages: `<key>: <what>` e.g. `F3: add Drizzle schema`.
- Open a **draft PR into `develop`** as soon as you have your first commit: title `<key>: <what>`,
  body ending with `Closes #<this issue>`. Mark it ready for review once every acceptance criterion
  passes and CI is green (CI arrives in #22 — until then there is no CI: validate locally and
  paste the output in the closing note).
- **Never merge your own PR** and never merge anything into `develop` or `main` — Dávid merges.
  Keep the PR mergeable: rebase onto `develop` when it falls behind, keep CI green, and answer
  review comments on the PR.
- Change only what this issue scopes. If you touch a shared file (root config, `packages/core`
  types) keep the diff minimal and mention it in your closing note.
- Code, comments, commits: English. Every user-facing string: Hungarian, in the app's `strings.ts`;
  never inline.
- Domain logic lives in `packages/core` with unit tests; HTTP handlers and React components stay
  thin.
- No secrets in the repo. New env vars go into `.env.example` with a comment.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` must pass before you commit.
- Do not reopen decisions listed in `docs/PLAN.md` §2. If one blocks you, stop (see below) rather
  than deviating.
- Do not add dependencies beyond those named in the issue without a one-line justification in the
  closing note.
- Close with a comment on the issue: what was built, what was deliberately left out, anything
  surprising, and any follow-up you recommend.

## Stop conditions — stop, write what you found on the issue, do not guess

- A blocker issue is still open, or its output is missing from `develop`.
- A required secret, account or external resource is absent (Neon branch, Clerk keys, SES identity,
  Cloudflare token).
- Implementing the scope would require changing a decision in `docs/PLAN.md` §2 or a rule in
  `docs/STACK.md` §6.
- The acceptance criteria cannot be validated with the means listed under Validation.
- The work needs more than roughly one working day; split and propose the split instead.
