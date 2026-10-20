# Staff access

Staff sign in on the admin through Clerk and must be members of the restaurant's organization.
Signed out, every admin route sends them to `/login`. A signed-in non-member sees "Nincs
hozzáférésed". Members get the shell: a sidebar with "Rendelések", "Napi összesítő", "Heti
menü" and "Étlap", the restaurant name in the top bar, and the API version in the sidebar
footer. The API enforces the same rule on `/api/admin/*`.

## Sub-features

- `api-401`: `/api/admin/*` with no bearer token, or with a token the key rejects, returns 401
  `{ error: 'unauthenticated' }`. This applies to unknown admin paths too.
- `api-403`: a valid session outside `CLERK_ORG_ID` returns 403 `{ error: 'forbidden' }`.
- `api-200`: a member's token returns 200. `GET /api/admin/ping` gives `{ userId }`, and
  `GET /api/admin/config` gives `{ name }`.
- `shell`: the signed-in layout, its navigation links, `/` redirecting to `/rendelesek`, and
  "Ez az oldal nem létezik" for unknown paths.
- `sign-in`: Clerk's hosted sign-in at `/login`, with `redirect_url` back to the page you came
  from. **Not drivable by an agent.**

## How to get to it (user POV)

- Open `$ADMIN_URL/` or any admin route.
- Use the sidebar links (`link` names above, hrefs `/rendelesek`, `/osszesito`, `/heti-menu`,
  `/etlap`).
- API clients call `$API_URL/api/admin/*`.

## Driving it with the browser pane and api.sh

Preconditions:

- `doctor.sh` exits 0. Its two `/api/admin/ping` checks are `api-401` and `api-200` already.

- **401.** Run `api.sh --anon --save staff-access.401 GET /api/admin/ping`, and also
  `api.sh --anon GET /api/admin/nope`. Both return 401.
- **403.** No forged non-member token is shipped. Mint one only if the issue is about 403: copy
  `prepare.mjs`'s signing into a scratch script with `o.id` changed, using a key that is not the
  run's. Otherwise rely on the unit tests in `apps/api` and say so.
- **200.** Run `api.sh --save staff-access.200 GET /api/admin/config`. Expect
  `{"name":"Piccolo Club Étterem"}`.
- **Shell.** Navigate to `$ADMIN_URL/`. The URL becomes `/rendelesek`, and the heading
  "Rendelések" shows with "Ez a képernyő még készül". Click each sidebar link and check its
  `heading`. Navigate to `$ADMIN_URL/nincs-ilyen` and expect "Ez az oldal nem létezik". The
  sidebar footer reads "API-verzió" with the version from `/api/health`.
- **Real sign-in.** Hand Dávid the steps:
  - run `pnpm dev`, open <http://localhost:5173/heti-menu> signed out;
  - expect `/login?redirect_url=…`, sign in, and land back on `/heti-menu`;
  - for API checks, the token is `await window.Clerk.session.getToken()` in that tab's console.
- **Proof.** The `.http` files, plus a `shot.sh "$ADMIN_URL/rendelesek" staff-access.shell`
  PNG.

## Gotchas

- Under the stub, `/login` renders nothing, and the top bar has no user menu: `SignIn` and
  `UserButton` are stubbed to `null`. Sign-out (the "Kijelentkezés" button on "Nincs
  hozzáférésed", and the forced sign-out after a 401) only logs `[verify] Clerk signOut called`.
  Missing sign-in UI is the stub, not a bug.
- The stub covers exactly the `@clerk/react` exports the admin imports. If an issue adds an
  import, Vite fails with a missing export in `logs/admin.log`. Add the export to
  `scripts/clerk-stub.js` in the same PR.
- The run's token is valid for 12 hours, and only against this run's API: each run has its own
  key and admin origin (`azp`).
- `CLERK_AUTHORIZED_PARTIES` is the run's admin URL. A request from another admin origin with
  the run's token fails `azp` and gets 401.
