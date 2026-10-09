# Permanent menu (Étlap)

At `/etlap` staff edit the permanent items in five sections: "Egész héten rendelhető",
"Desszertek", "Savanyúságok", "Köretek" and "Feláras köretek". They can rename items and change
prices, variations, allergens, side requirement and order. They add new items, deactivate and
reactivate items, and save everything with one "Mentés". The "Elfogyott" switch marks an item
sold out at once, with no save. Guests see the result in the public menu.

## Sub-features

- `etlap-load`: every section loads from `GET /api/admin/menu/items`, inactive items included.
- `etlap-sold-out`: the "Elfogyott" switch posts to `/api/admin/menu/items/<id>/sold-out`
  immediately. Guests see the item flagged `soldOut`. It is disabled on unsaved rows, which show
  "Mentés után állítható".
- `etlap-save`: edits mark the page "Nem mentett változások." and enable "Mentés". Saving shows
  the toast "Az étlap elmentve." and the footer "Minden változás elmentve." Invalid fields show
  "<n> hibás mező. Javítsd, majd mentsd újra."
- `etlap-add`: "Új tétel" adds a row to that section. A new row's "Új tétel elvetése" removes it
  before saving.
- `etlap-active`: the "Aktív" switch, and "Visszaaktiválás" for inactive rows. Items are never
  deleted.
- `etlap-order`: "Feljebb" / "Lejjebb" reorder rows within a section.
- `etlap-discard`: "Változások elvetése" asks "Elveted a változásokat?" and restores the loaded
  values.

## How to get to it (user POV)

- Click the "Étlap" link in the sidebar.
- Open `$ADMIN_URL/etlap` directly.

## Driving it with the browser pane and api.sh

Preconditions:

- `doctor.sh` exits 0.
- Pick the target item and snapshot it:
  `sql.mjs 'select id, name, category, sold_out, active, price_weekday, sort_order, updated_at from menu_items where id = $1' <id>`,
  saved as `etlap-<sub>.before.json`. The seed's permanent items have fixed ids, for example
  `00000000-0000-4000-8000-000000000107` (Túrós palacsinta, Desszertek).

- **Open.** Navigate to `$ADMIN_URL/etlap`. Five `region`s appear, each headed by its section
  name. Each row has textboxes "Név", "Leírás" and "Ár hétköznap (Ft)", a button
  "Allergének: …", and switches "Elfogyott" and "Aktív".
- **Find the row.** `find` returns one "Elfogyott" switch per row, in page order, after each
  section's "Elfogyott" column header. To be sure which row a ref is, read the section's
  `Név` value with a read-only `javascript_tool` query on
  `section` → `input[aria-label="Név"]` / `[role=switch][aria-label="Elfogyott"]`
  (`aria-checked`).
- **Sold out.** Click the row's "Elfogyott" switch.
  - The API log shows `OPTIONS …/sold-out 204` and `POST …/sold-out 200`.
  - The row has `sold_out = true`; save it as `after-on.json`.
  - Reload: the switch is still `aria-checked="true"`.
  - The guest view `api.sh --save etlap-sold-out.public GET '/api/menu?week=<a published week>'`
    shows the item with `soldOut: true`.
- **Restore.** Click the switch again (find its ref again after the reload). The row has
  `sold_out = false`; save it as `restored.json`.
- **Save edits.** Change a field, click "Mentés", and wait for "Az étlap elmentve."
  - Reload: the value persists. `api.sh GET /api/admin/menu/items` shows it too.
  - Restore the value through the UI, save again, and snapshot.
  - Run `api.sh` on the public menu twice. The second read should show `X-Db-Queries: 0` (cached
    again after the purge). After the save, the first read must not be 0.
- **Proof.** The before / after-on / restored JSON, the API-log lines, the guest-view `.http` file,
  and a `shot.sh "$ADMIN_URL/etlap" etlap-<sub>.page` PNG.

## Gotchas

- Every change here is live for every guest of the shared development database. Restore it in
  the same run, through the UI. Only `updated_at` may differ from the before snapshot. Say so.
- `read_page` with `filter: "interactive"` sometimes omits the Radix switches. Use `find`
  "Elfogyott" or `filter: "all"`.
- Refs change after a reload or a save. Run `find` again before each click.
- An item's `soldOut` also shows in the weekly menu, which has its own "Elfogyott" per card.
  Both routes are the same `POST /items/:id/sold-out`.
- A guest sees the change in `GET /api/menu` only for a published week. The current window
  answers `next_week_not_published` with no items. Read a published week with `?week=`.
- New rows get their id on save. Their "Elfogyott" switch is disabled until then; that is
  intended.
