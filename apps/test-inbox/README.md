# @piccolo/test-inbox

A mailbox that agents can read, so the verify skill can prove the order confirmation e-mail end to
end: sent through SES, received, DKIM passing, content correct (issue #121). It is test tooling, not
part of the product. There is one for the whole project, not one per customer, and it is not
deployed by CI.

- **Receiving.** Cloudflare Email Routing is enabled on the subdomain `inbox.piccoloetterem.hu`
  only. Its MX records point there to `route{1,2,3}.mx.cloudflare.net`. The zone's catch-all rule
  hands every message to this Worker's `email` handler, which rejects any recipient outside
  `INBOX_DOMAIN` and any message over 1 MB.
- **Storing.** Each message goes to the R2 bucket `piccolo-test-inbox`, at
  `messages/<to>/<received ISO>-<uuid>.eml`. Its custom metadata holds From, To, the decoded
  Subject, Date and the `Authentication-Results` header. A lifecycle rule deletes everything after
  1 day. R2, not KV, because reads and lists are strongly consistent, so a poller sees a message
  as soon as it lands.
- **Reading.** `https://inbox.piccoloetterem.hu`. Every route needs
  `Authorization: Bearer <INBOX_TOKEN>`.

| Route | Response |
|---|---|
| `GET /messages?to=<address>` | `{ messages }`, newest first. Each is `{ id, to, from, subject, date, receivedAt, authenticationResults, dkim: [{ result, domain }], spf, dmarc }` |
| `GET /messages/<id>` | The same fields plus `text` and `html`. URL-encode the id; it contains `@` and `/` |
| `GET /messages/<id>/raw` | The `.eml`, `message/rfc822` |

The verify skill's `scripts/inbox.mjs` is the client: it waits for a message and saves it as
evidence. See `.claude/skills/verify/features/order-confirmation-email.md`.

## The root domain is not touched

`piccoloetterem.hu`'s own MX (`mail.piccoloetterem.hu`, the real `info@` mailbox) and its SPF are
unchanged. Because a subdomain is enabled, the dashboard shows Email Routing for the apex as
enabled but **misconfigured**. Leave it like that. **Never** use the dashboard's offer to add or
fix the apex's records: it would replace the root MX and cut off `info@`. Root mail never reaches
Cloudflare, so the catch-all only ever sees the subdomain. The `INBOX_DOMAIN` check is a second
guard.

## One-time setup (done 2026-10-16)

```bash
pnpm --filter @piccolo/test-inbox exec wrangler r2 bucket create piccolo-test-inbox
pnpm --filter @piccolo/test-inbox exec wrangler r2 bucket lifecycle add piccolo-test-inbox expire-1d --expire-days 1
```

Email Routing on the subdomain, through the API, because the dashboard starts from the apex and
`wrangler email routing enable` takes a zone:

```bash
curl -X POST -H "Authorization: Bearer $CF_TOKEN" -H 'content-type: application/json' \
  -d '{"name":"inbox.piccoloetterem.hu"}' \
  https://api.cloudflare.com/client/v4/zones/<zone id>/email/routing/dns
```

Deploy, then set the token. The same value goes in the root `.env` as `TEST_INBOX_TOKEN`, next to
`TEST_INBOX_URL=https://inbox.piccoloetterem.hu`:

```bash
pnpm --filter @piccolo/test-inbox deploy
openssl rand -hex 32 | pnpm --filter @piccolo/test-inbox exec wrangler secret put INBOX_TOKEN
```

The catch-all rule pointing at the Worker. `wrangler email routing rules update … catch-all` does
not accept a Worker action, so this also goes through the API:

```bash
curl -X PUT -H "Authorization: Bearer $CF_TOKEN" -H 'content-type: application/json' \
  -d '{"name":"test inbox","enabled":true,"matchers":[{"type":"all"}],"actions":[{"type":"worker","value":["piccolo-test-inbox"]}]}' \
  https://api.cloudflare.com/client/v4/zones/<zone id>/email/routing/rules/catch_all
```

**Rotating the token:** run `wrangler secret put INBOX_TOKEN` with a new value, and change
`TEST_INBOX_TOKEN` in the root `.env`.
