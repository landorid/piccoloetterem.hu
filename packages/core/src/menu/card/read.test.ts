import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { isoWeekOf, parseIsoDate } from '../../calendar';
import { planWeek } from '../edit';
import { type ImportFinding, readMenuCard } from './read';

/*
 * The six real cards, each named by its Monday so the week to read it into is derived from the
 * name, and hand-written cards for the trouble the real ones do not show. The oracle for every
 * card: core's own save rules accept the week as it is read.
 */

const cards = [
  '2025-12-22',
  '2026-05-25',
  '2026-06-15',
  '2026-07-06',
  '2026-07-13',
  '2026-08-03',
] as const;

const bytes = (name: string) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}.docx`, import.meta.url)));
const weekOf = (name: string) => isoWeekOf(parseIsoDate(name, 'UTC'));

function read(name: string) {
  const result = readMenuCard(bytes(name), weekOf(name));
  if (!result.ok) {
    throw new Error(`${name}: ${result.reason}`);
  }
  return result;
}

const avocado = 'Avokádó krémmel töltött gomba bécsi bundában, párolt rizzsel';
const expectedFindings: Record<(typeof cards)[number], ImportFinding[]> = {
  '2025-12-22': [
    {
      kind: 'day_without_dishes',
      day: 3,
      texts: [
        'Nyitva tartás 9:30-tól 13.00-ig',
        'Előrendelt',
        'ételek átvétele!!',
        'Nagyon boldog karácsonyi',
        'Ünnepeket kívánunk!!',
      ],
      withheld: [],
    },
    { kind: 'day_without_dishes', day: 4, texts: ['Zárva'], withheld: [] },
    { kind: 'day_without_dishes', day: 5, texts: ['Zárva'], withheld: [] },
    { kind: 'day_without_dishes', day: 6, texts: ['Zárva', 'Nyitás December 29.'], withheld: [] },
    {
      kind: 'cell_skipped',
      where: { part: 'daily', row: 'c', days: [1, 2] },
      text: 'Kedves Vendégeink!! Köszönjük, hogy egész évben kitartottak mellettünk!!! Boldog, Békés karácsonyt kívánunk! Üdvözlettel: Piccolo csapata',
    },
  ],
  '2026-05-25': [
    {
      kind: 'day_without_dishes',
      day: 1,
      texts: ['Pünkösd', 'Hétfő', 'Zárva!', 'Nyitás:', '05.26. Kedd'],
      withheld: [avocado],
    },
    {
      kind: 'allergens_missing',
      where: { part: 'featured', position: 1 },
      name: 'Pándy meggyleves tejszínhabbal',
    },
  ],
  '2026-06-15': [],
  '2026-07-06': [],
  '2026-07-13': [],
  '2026-08-03': [],
};

describe.each(cards)('card %s', (name) => {
  it('reads a week that core saves as it is', () => {
    expect(planWeek(read(name).draft, new Map())).toMatchObject({ ok: true });
  });

  it('reports exactly what it left out, and nothing about the week it belongs to', () => {
    expect(read(name).findings).toEqual(expectedFindings[name]);
  });

  it('reads the same bytes the same way', () => {
    expect(read(name)).toEqual(read(name));
  });
});

describe('2026-06-15, a normal week', () => {
  const { draft } = read('2026-06-15');

  it('reads Monday: two soups, the no-soup main of row c, then mains with the row prices', () => {
    expect(draft.days[1].soups).toEqual([
      {
        name: 'Erőleves',
        description: 'finommetélttel',
        priceWeekday: 0,
        priceWeekend: null,
        variations: [],
        allergens: ['gluten'],
        soupIncluded: false,
        requiresSide: false,
      },
      expect.objectContaining({ name: 'Zöldség krémleves', allergens: ['gluten', 'milk'] }),
    ]);
    expect(draft.days[1].mains).toEqual([
      {
        name: 'Rántott csirkemáj petrezselymes rizzsel',
        description: null,
        priceWeekday: 2850,
        priceWeekend: null,
        variations: [],
        allergens: ['gluten', 'eggs', 'milk'],
        soupIncluded: false,
        requiresSide: false,
      },
      {
        name: 'Lencsefőzelék',
        description: null,
        priceWeekday: 2200,
        priceWeekend: null,
        variations: ['sült kolbásszal', 'szója fasírttal'],
        allergens: ['gluten'],
        soupIncluded: true,
        requiresSide: false,
      },
      expect.objectContaining({ name: 'Túrós tészta', priceWeekday: 2300, soupIncluded: true }),
      expect.objectContaining({ name: 'Gombás sertésszelet', priceWeekday: 2400 }),
    ]);
  });

  it("gives Saturday's mains the row price and their own price for the weekend", () => {
    expect(
      draft.days[6].mains.map((main) => [main.priceWeekday, main.priceWeekend, main.soupIncluded]),
    ).toEqual([
      [2850, 3050, false],
      [2200, 2590, true],
      [2300, 2690, true],
      [2400, 2790, true],
    ]);
  });

  it('imports all seven featured dishes with weekday and Saturday prices', () => {
    expect(draft.featured.map((dish) => [dish.name, dish.priceWeekday, dish.priceWeekend])).toEqual(
      [
        ['Nyári hideg bíborbársony leves', 1090, null],
        [
          'Nyár slágere lesz!! Római hideg burgonya tál zöldségekkel bolondítva, szezámmagos rántott csirkével',
          3190,
          3290,
        ],
        ['Vicákné kedvence', 3190, 3290],
        ['Húsimádók kedvence', 3190, 3290],
        ['Walesi csülök', 3190, 3290],
        ['2 személyes Aréna tál', 12990, null],
        ['4 személyes Aréna tál', 18990, null],
      ],
    );
  });
});

describe('days the card closes', () => {
  it('imports nothing for Pünkösd Monday, not even row c, which it shares', () => {
    const { draft } = read('2026-05-25');
    expect(draft.days[1]).toEqual({ soups: [], mains: [] });
    expect(draft.days[2].mains[0]?.name).toBe(avocado);
  });

  it('imports Christmas week for Monday and Tuesday only, with its four featured dishes', () => {
    const { draft } = read('2025-12-22');
    expect(([3, 4, 5, 6] as const).map((day) => draft.days[day])).toEqual(
      Array(4).fill({ soups: [], mains: [] }),
    );
    expect(draft.days[1].mains.map((main) => main.name)).toEqual([
      'Sárgaborsó főzelék',
      'Frankfurti tokány',
    ]);
    expect(draft.featured).toHaveLength(4);
  });
});

it("reads row c's Saturday copy as the Monday–Friday dish, however it is wrapped", () => {
  const { draft } = read('2026-07-06');
  const { priceWeekend: _, ...saturday } = draft.days[6].mains[0] ?? {};
  const { priceWeekend: __, ...monday } = draft.days[1].mains[0] ?? {};
  expect(saturday).toEqual(monday);
  expect(monday).toMatchObject({
    name: 'Baconnel sült csirkemáj sajtmártással, párolt rizzsel',
    description: null,
  });
});

it('says when the card starts on another Monday than the week being edited', () => {
  const result = readMenuCard(bytes('2026-06-15'), { isoYear: 2026, isoWeek: 26 });
  expect(result.ok && result.findings).toEqual([
    {
      kind: 'week_mismatch',
      card: { from: { month: 6, day: 15 }, to: { month: 6, day: 20 } },
      week: { from: { month: 6, day: 22 }, to: { month: 6, day: 27 } },
    },
  ]);
});

/*
 * A card written by hand: the real template's header (one column per day, Áraink between Friday
 * and Saturday, 8 columns), day rows of [label, Monday … Friday, prices, Saturday], and full-width
 * rows. A cell is its lines.
 */
const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const tc = (lines: readonly string[], span = 1) =>
  `<w:tc><w:tcPr><w:gridSpan w:val="${span}"/></w:tcPr>${lines.map(p).join('') || '<w:p/>'}</w:tc>`;
const tr = (...cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;
const dayRow = (label: string, days: string[][], prices: string[], saturday: string[]) =>
  tr(tc([label]), ...days.map((lines) => tc(lines)), tc(prices), tc(saturday));
const heading = (title: string) => tr(tc([title], 8));
const header = tr(
  ...['', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Áraink', 'Szombat'].map((text) =>
    tc(text === '' ? [] : [text]),
  ),
);
const handWritten = (body: string) =>
  zipSync({
    'word/document.xml': strToU8(`<w:document xmlns:w="w"><w:body>${body}</w:body></w:document>`),
  });
const week = { isoYear: 2026, isoWeek: 25 };
const soup = ['Leves', '1'];

describe('a hand-written card with every kind of trouble', () => {
  const card = handWritten(
    `<w:tbl>${[
      header,
      dayRow('a', Array(5).fill(soup), ['a menü ára tartalmaz'], soup),
      dayRow(
        'b',
        [['Rántott sajt', '1,15'], ...Array(4).fill(['Pörkölt', '1'])],
        ['2200 Ft', 'kenyérrel'],
        ['Pörkölt', '1'],
      ),
      dayRow('c', [['Főzelék', '1'], [], [], [], []], [], ['Gulyás', '1', '2590 Ft']),
      heading('Heti meglepetés'),
      tr(tc(['Titkos étel 1'], 7), tc(['990 Ft'])),
      heading('Kiemelt ajánlatunk'),
      tr(tc(['Rántott hal 1,4', 'Rántott sajt 1,7'], 7), tc(['Hétköznap Szombat', '3190 Ft'])),
      heading('Egész héten rendelhető ételek'),
      heading('Kiemelt ajánlatunk'),
    ].join('')}</w:tbl>`,
  );

  it('reports each, in card order, and imports what it can', () => {
    const result = readMenuCard(card, week);
    expect(result.ok && result.findings).toEqual([
      { kind: 'week_unverified' },
      { kind: 'price_note_ignored', row: 'b', text: '2200 Ft kenyérrel' },
      {
        kind: 'allergen_unknown',
        where: { part: 'daily', row: 'b', days: [1] },
        name: 'Rántott sajt',
        numbers: [15],
      },
      {
        kind: 'weekend_price_missing',
        where: { part: 'daily', row: 'b', days: [6] },
        name: 'Pörkölt',
      },
      { kind: 'price_missing', where: { part: 'daily', row: 'c', days: [1] }, name: 'Főzelék' },
      { kind: 'section_skipped', title: 'Heti meglepetés' },
      { kind: 'featured_unpaired', dishes: ['Rántott hal', 'Rántott sajt'], prices: 1 },
    ]);
    expect(result.ok && planWeek(result.draft, new Map())).toMatchObject({ ok: true });
    expect(result.ok && result.draft.days[1].mains).toEqual([
      expect.objectContaining({ name: 'Rántott sajt', priceWeekday: 2200, allergens: ['gluten'] }),
    ]);
    expect(result.ok && result.draft.days[6].mains).toEqual([
      expect.objectContaining({ name: 'Pörkölt', priceWeekday: 2200, priceWeekend: null }),
      expect.objectContaining({ name: 'Gulyás', priceWeekday: 2590, priceWeekend: null }),
    ]);
    expect(result.ok && result.draft.featured).toEqual([]);
  });

  it('takes "no soup" from a featured price line too, and only about a soup', () => {
    const result = readMenuCard(
      handWritten(
        `<w:tbl>${header}${heading('Kiemelt ajánlatunk')}${tr(
          tc(['Aréna tál 1', 'Rántott szelet /nem tartalmaz glutént/ 3'], 7),
          tc(['12990 Ft Levest nem tartalmaz', '3190 Ft']),
        )}</w:tbl>`,
      ),
      week,
    );
    expect(result.ok && result.draft.featured).toEqual([
      expect.objectContaining({ name: 'Aréna tál', priceWeekday: 12990, soupIncluded: false }),
      expect.objectContaining({ name: 'Rántott szelet', priceWeekday: 3190, soupIncluded: true }),
    ]);
  });
});

describe('a file that is not a menu card', () => {
  it('passes on why a file is not a readable .docx', () => {
    const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(readMenuCard(doc, week)).toEqual({ ok: false, reason: 'legacy_doc' });
  });

  it('is no_menu_table for a Word file without the day table', () => {
    expect(readMenuCard(handWritten(p('Kedves Vendégeink!')), week)).toEqual({
      ok: false,
      reason: 'no_menu_table',
    });
  });

  it('is nothing_found for a card without a single dish', () => {
    const closed = dayRow('a', Array(5).fill(['Zárva']), [], ['Zárva']);
    expect(readMenuCard(handWritten(`<w:tbl>${header}${closed}</w:tbl>`), week)).toEqual({
      ok: false,
      reason: 'nothing_found',
    });
  });
});
