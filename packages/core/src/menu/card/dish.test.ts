import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type DishText, readDayCell, readFeaturedLine, readPrices } from './dish';
import { readDocx } from './docx';
import { saysNoSoup } from './vocabulary.hu';

/*
 * One dish's text, with cells copied from the six example cards. The name/description split is
 * the rule most likely to be tuned: each case pins one part of it, and its known misses are pinned
 * with `it.fails`, so a better rule shows up here as a failing "fails" rather than unnoticed.
 */

describe('readDayCell: name and description', () => {
  it.each([
    [['Erőleves', 'finommetélttel', '1'], 'Erőleves', 'finommetélttel'],
    [['Magyaros', 'gombaleves', '1'], 'Magyaros gombaleves', null],
    [['Csopaki', 'tokány', 'tésztaágyon', '1'], 'Csopaki tokány', 'tésztaágyon'],
    [
      ['Parajfőzelék', 'főtt burgonyával', 'tojás pogácsával', '1,7'],
      'Parajfőzelék',
      'főtt burgonyával tojás pogácsával',
    ],
    [
      ['Csabai töltött karaj', 'petrezselymes', 'burgonyával', '1,3,7', '2690 Ft'],
      'Csabai töltött karaj',
      'petrezselymes burgonyával',
    ],
    [['Aranygaluska', 'vaníliás', 'tejsodóval', '1,7'], 'Aranygaluska', 'vaníliás tejsodóval'],
    [
      ['Barackos', 'máglyarakás', 'fahéjas porcukorral', '1,3,7'],
      'Barackos máglyarakás',
      'fahéjas porcukorral',
    ],
    [
      ['Fűszeres', 'gombapaprikás', 'tésztaágyon', '1,7', '2590 Ft'],
      'Fűszeres gombapaprikás',
      'tésztaágyon',
    ],
    [['Chili-Con', 'Carne', '/chilis bab/', '1', '2590 Ft'], 'Chili-Con Carne', '/chilis bab/'],
    [
      [
        'Gladiátor töltött borda',
        '/szalámi,mustár,',
        'lilahagyma,sajt/',
        'vegyes körettel',
        '1,3,7',
        '2790 Ft',
      ],
      'Gladiátor töltött borda',
      '/szalámi,mustár, lilahagyma,sajt/ vegyes körettel',
    ],
    [
      ['Baconnel sült csirkemáj sajtmártással,', 'párolt rizzsel', '1,7', '3050 Ft'],
      'Baconnel sült csirkemáj sajtmártással',
      'párolt rizzsel',
    ],
    [
      ['Rántott csirkemáj petrezselymes rizzsel 1,3,7'],
      'Rántott csirkemáj petrezselymes rizzsel',
      null,
    ],
  ])('%j -> %s / %s', (lines, name, description) => {
    expect(readDayCell(lines)).toMatchObject({ name, description });
  });

  it.fails.each([
    [['Mákos guba', 'vanília', 'mártással', '1,7'], 'Mákos guba', 'vanília mártással'],
    [['Székelykáposzta', 'benne főtt', 'hússal', '1'], 'Székelykáposzta', 'benne főtt hússal'],
  ])('misses %j -> %s / %s', (lines, name, description) => {
    expect(readDayCell(lines)).toMatchObject({ name, description });
  });
});

describe('readDayCell: a dashed alternative', () => {
  it('makes the topping line and the alternative two variations, with no description', () => {
    expect(
      readDayCell(['Lencsefőzelék', 'sült kolbásszal', '----------szója fasírttal', '1']),
    ).toEqual({
      name: 'Lencsefőzelék',
      description: null,
      variations: ['sült kolbásszal', 'szója fasírttal'],
      allergenNumbers: [1],
      price: null,
    });
  });

  it('keeps a name of two lines whole', () => {
    expect(
      readDayCell(['Paradicsomos', 'káposzta', 'sertéssülttel', '----szója golyóval', '1,3']),
    ).toMatchObject({
      name: 'Paradicsomos káposzta',
      variations: ['sertéssülttel', 'szója golyóval'],
    });
  });

  it('keeps an alternative with no topping line to pair as the description', () => {
    expect(readDayCell(['Főzelék', '----szója fasírttal', '1'])).toMatchObject({
      name: 'Főzelék',
      description: 'szója fasírttal',
      variations: [],
    });
  });
});

describe('readDayCell: allergens and price', () => {
  it('reads a line of numbers, a Saturday price line after it, and inline numbers', () => {
    expect(readDayCell(['Pásztor tarhonya', 'cecei almapaprikával', '1', '2690 Ft'])).toMatchObject(
      { allergenNumbers: [1], price: 2690 },
    );
    expect(readDayCell(['Rántott sertésszelet vagy rántott csirkemell1,3,7'])).toMatchObject({
      name: 'Rántott sertésszelet vagy rántott csirkemell',
      allergenNumbers: [1, 3, 7],
    });
  });

  it('takes a price line alone for a dish whose allergens the card left out', () => {
    expect(readDayCell(['Pásztor tarhonya', '2690 Ft'])).toMatchObject({
      name: 'Pásztor tarhonya',
      allergenNumbers: null,
      price: 2690,
    });
  });

  it.each([
    [[]],
    [['Zárva']],
    [['Pünkösd']],
    [['05.26.', 'Kedd']],
    [['Nyitás December 29.']],
    [['Nyitás December 29']],
    [['Nyitva tartás', '9:30-tól 13.00-ig']],
    [['Kedves Vendégeink!!', 'Boldog, Békés karácsonyt kívánunk!']],
    [['1,7']],
  ])('is null for %j: not a dish', (lines) => {
    expect(readDayCell(lines)).toBeNull();
  });
});

describe('readFeaturedLine', () => {
  it('reads the numbers right after a closing slash', () => {
    expect(
      readFeaturedLine(
        'Húsimádók kedvence /bolognai spagetti rántott bordával, reszelt sajttal/ 1,3,7',
      ),
    ).toEqual({
      name: 'Húsimádók kedvence',
      description: '/bolognai spagetti rántott bordával, reszelt sajttal/',
      variations: [],
      allergenNumbers: [1, 3, 7],
      price: null,
    });
  });

  it('splits at the first parenthesis, keeps the rest verbatim, and reads no price from it', () => {
    expect(
      readFeaturedLine(
        '2 személyes Aréna tál (2db Cordon(karaj), 2db Rántott sajt) vegyes körettel +1000 Ft csomagolás 1,3,7',
      ),
    ).toMatchObject({
      name: '2 személyes Aréna tál',
      description: '(2db Cordon(karaj), 2db Rántott sajt) vegyes körettel +1000 Ft csomagolás',
      price: null,
    });
  });

  it('marks a dish listed without numbers, and does not take /2db/ for them', () => {
    expect(readFeaturedLine('Pándy meggyleves tejszínhabbal')).toMatchObject({
      name: 'Pándy meggyleves tejszínhabbal',
      description: null,
      allergenNumbers: null,
    });
    expect(readFeaturedLine('Túrós palacsinta /2db/')).toMatchObject({ allergenNumbers: null });
  });
});

describe('the price column', () => {
  it.each([
    ['3190 Ft 3290 Ft', [3190, 3290]],
    ['2300Ft', [2300]],
    ['Nem tartalmaz levest! 2850Ft', [2850]],
    ['12 990 Ft 12.990 Ft', [12990, 12990]],
    ['Hétköznap Szombat', []],
    ['Egy választott levest (a-b) a menü ára tartalmaz', []],
  ])('readPrices(%j) is %j', (text, prices) => {
    expect(readPrices(text)).toEqual(prices);
  });

  it.each([
    ['Nem tartalmaz levest! 2850Ft', true],
    ['Levest nem tartalmaz', true],
    ['Rántott sajt leves nélkül', true],
    ['Egy választott levest (a-b) a menü ára tartalmaz', false],
    ['a menü ára tartalmaz', false],
    ['Nem tartalmaz glutént', false],
    ['Rántott szelet, nem tartalmaz tejet', false],
    ['2200 Ft', false],
  ])('saysNoSoup(%j) is %s', (text, result) => {
    expect(saysNoSoup(text)).toBe(result);
  });
});

describe('on the six cards', () => {
  const cells = [
    '2025-12-22',
    '2026-05-25',
    '2026-06-15',
    '2026-07-06',
    '2026-07-13',
    '2026-08-03',
  ].flatMap((name) => {
    const docx = readDocx(
      new Uint8Array(readFileSync(new URL(`./fixtures/${name}.docx`, import.meta.url))),
    );
    return docx.ok ? docx.body.tables.flat().flatMap((row) => row.map((cell) => cell.lines)) : [];
  });

  /** The text without spaces, commas, digits, dashes and `Ft`: what a dish must keep, in order. */
  const letters = (texts: readonly (string | null)[]) =>
    texts.join(' ').replace(/Ft\b|[\d\s,-]/g, '');
  const dishLetters = (dish: DishText) =>
    letters([dish.name, dish.description, ...dish.variations]);

  it('keeps every word of every dish cell: a wrong split moves words, never drops them', () => {
    const dishes = cells.flatMap((lines) => {
      const dish = readDayCell(lines);
      return dish ? [[lines, dish] as const] : [];
    });
    expect(dishes.length).toBeGreaterThan(200);
    for (const [lines, dish] of dishes) {
      expect(dishLetters(dish), lines.join(' / ')).toBe(letters(lines));
    }
  });

  it('keeps every word of every featured paragraph', () => {
    for (const line of cells.flat()) {
      expect(dishLetters(readFeaturedLine(line)), line).toBe(letters([line]));
    }
  });
});
