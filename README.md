# Piccolo

Online lunch ordering for Piccolo Club Étterem, Szombathely. Guests order the weekly menu without an
account; staff publish the menu and process the orders.

Start with [AGENTS.md](AGENTS.md) for the layout, commands and branch policy, then
[docs/PLAN.md](docs/PLAN.md) and [docs/STACK.md](docs/STACK.md).

## External services

```mermaid
flowchart LR
  guest([Guest browser])
  staff([Staff browser])

  subgraph cf [Cloudflare · Workers Free]
    web[web Worker<br/>Astro · #lt;domain#gt;]
    admin[admin Worker<br/>Vite SPA · admin.#lt;domain#gt;]
    api[api Worker<br/>Hono · api.#lt;domain#gt;]
    kv[(KV<br/>menu cache · order rate limit)]
    r2[(R2<br/>item images · img.#lt;domain#gt;)]
    hd[Hyperdrive<br/>connection pool]
    logs[Workers Logs]
    inbox[test-inbox Worker<br/>Email Routing + R2]
  end

  clerk[Clerk<br/>staff auth]
  ses[Amazon SES<br/>confirmation e-mail]
  sendops[SendOps<br/>observes SES]
  sentry[Sentry<br/>errors · DSN not set yet]
  neon[(Neon Postgres<br/>project per customer)]
  gha[GitHub Actions<br/>deploy · migrations]

  guest --> web
  guest -- images --> r2
  staff --> admin
  staff -- sign-in --> clerk
  web --> api
  admin --> api
  api --> kv
  api -- writes --> r2
  api --> hd --> neon
  api -- verifies JWT --> clerk
  api --> ses
  ses -.-> sendops
  api -.-> sentry
  api -.-> logs
  ses -. verify runs .-> inbox
  gha --> cf
  gha --> neon
```

- **Cloudflare** runs three Workers per customer, each on its own hostname. The frontends call the
  API cross-origin. The api Worker's bindings and secrets are listed in
  [apps/api/README.md](apps/api/README.md).
- **Neon** is reached only through Hyperdrive when deployed; locally `DATABASE_URL` connects
  directly.
- **SES** is called with `aws4fetch`, not the AWS SDK. SendOps watches deliveries and is not in the
  sending path.
- **Sentry** is wired into the API (`@sentry/cloudflare`) but stays off until `SENTRY_DSN` is set.
- **test-inbox** is test tooling for the verify skill, one for the whole project, not deployed by
  CI. See [apps/test-inbox/README.md](apps/test-inbox/README.md).
- **Google Maps** appears only as a directions link on the landing page.
