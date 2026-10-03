import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load';
import type { MenuDay, MenuItem, PublicMenu, PublicMenuDay } from '../menu/types';
import type { IsPublished } from '../menu/window';
import { isEmail, normaliseEmailKey, normalisePhone } from './normalise';
import { orderMessagesHu } from './orderMessages.hu';
import { priceDay, priceMenu, priceSubmission } from './price';
import { type DayDraft, orderErrorCodes, type SubmissionDraft } from './types';
import { validateDay, validateMenu, validateSubmission } from './validate';

const config = loadConfig({ RESTAURANT: 'piccolo' });
const pickupOn = { ...config, pickupEnabled: true };
const tz = config.timezone;

function bud(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(new TZDate(year, month - 1, day, hours, minutes, tz).getTime());
}

const wednesdayMorning = bud(2026, 9, 9, 8, 0);
const published: IsPublished = (isoYear, isoWeek) => isoYear === 2026 && isoWeek === 37;

const WED = '2026-09-09';
const SAT = '2026-09-12';

function item(id: string, category: MenuItem['category'], extra: Partial<MenuItem> = {}): MenuItem {
  return {
    id,
    category,
    name: id,
    description: null,
    priceWeekday: category === 'daily_soup' ? 0 : 1000,
    priceWeekend: null,
    variations: [],
    allergens: [],
    soupIncluded: false,
    requiresSide: false,
    soldOut: false,
    active: true,
    sortOrder: 0,
    ...extra,
  };
}

const soup = item('soup', 'daily_soup', { name: 'Húsleves', priceWeekend: 0 });
const mainIncluded = item('main-included', 'daily_main', {
  name: 'Rántott szelet',
  priceWeekday: 1020,
  priceWeekend: 1800,
  soupIncluded: true,
});
const mainChoice = item('main-choice', 'daily_main', {
  name: 'Csirkepaprikás',
  priceWeekday: 1100,
  soupIncluded: true,
  variations: ['sertés', 'csirke'],
});
const mainSide = item('main-side', 'daily_main', {
  name: 'Főzelék',
  priceWeekday: 1450,
  priceWeekend: 1600,
  requiresSide: true,
});
const mainSold = item('main-sold', 'daily_main', {
  name: 'Elfogyott',
  soldOut: true,
  priceWeekday: 1300,
});
const mainInactive = item('main-inactive', 'daily_main', {
  name: 'Inaktív',
  active: false,
  variations: ['a'],
});
const mainMonday = item('main-monday', 'daily_main', { name: 'Hétfői', priceWeekday: 1500 });
const main2199 = item('main-2199', 'daily_main', { priceWeekday: 2199 });
const main2200 = item('main-2200', 'daily_main', { priceWeekday: 2200 });
const main2099 = item('main-2099', 'daily_main', { priceWeekday: 2099 });
const main500 = item('main-500', 'daily_main', { priceWeekday: 500 });
const featured = item('featured', 'featured', {
  name: 'Kiemelt',
  priceWeekday: 2000,
  soupIncluded: true,
});
const allWeek = item('all-week', 'all_week', { name: 'Egész héten', priceWeekday: 1700 });
const side = item('side', 'side', { name: 'Rizs', priceWeekday: 300, priceWeekend: 350 });
const sideExtra = item('side-extra', 'side_extra', { name: 'Sült krumpli', priceWeekday: 450 });
const sideSold = item('side-sold', 'side', {
  name: 'Elfogyott köret',
  soldOut: true,
  priceWeekday: 250,
});
const pickle = item('pickle', 'pickle', { name: 'Uborka', priceWeekday: 200 });
const dessert = item('dessert', 'dessert', {
  name: 'Palacsinta',
  priceWeekday: 500,
  priceWeekend: 600,
});
const dessertInactive = item('dessert-inactive', 'dessert', { active: false, priceWeekday: 400 });

const dates: Record<MenuDay, string> = {
  1: '2026-09-07',
  2: '2026-09-08',
  3: WED,
  4: '2026-09-10',
  5: '2026-09-11',
  6: SAT,
};

const dailyMains = [
  mainIncluded,
  mainChoice,
  mainSide,
  mainSold,
  mainInactive,
  main2199,
  main2200,
  main2099,
  main500,
];

function dayMenu(menuDay: MenuDay): PublicMenuDay {
  return {
    date: dates[menuDay],
    soups: [soup],
    mains: menuDay === 1 ? [...dailyMains, mainMonday] : dailyMains,
  };
}

const menu: PublicMenu = {
  isoYear: 2026,
  isoWeek: 37,
  weekLabel: '2026/37. hét (09.07 – 09.12)',
  days: {
    1: dayMenu(1),
    2: dayMenu(2),
    3: dayMenu(3),
    4: dayMenu(4),
    5: dayMenu(5),
    6: dayMenu(6),
  },
  featured: [featured],
  permanent: {
    allWeek: [allWeek],
    desserts: [dessert, dessertInactive],
    pickles: [pickle],
    sides: [side, sideSold],
    sideExtras: [sideExtra],
  },
};

function day(overrides: Partial<DayDraft> = {}): DayDraft {
  return {
    deliveryDate: WED,
    fulfilment: 'delivery',
    menus: [{ soupId: 'soup', mainId: 'main-included' }],
    extras: [],
    ...overrides,
  };
}

function submission(overrides: Partial<SubmissionDraft> = {}): SubmissionDraft {
  return {
    name: 'Kiss Anna',
    phone: '06 30 123 4567',
    email: 'anna@example.hu',
    address: '9700 Szombathely, Fő utca 1.',
    note: 'Kaputelefon',
    days: [day()],
    ...overrides,
  };
}

function errorsOf(
  draft: SubmissionDraft,
  options: {
    config?: typeof config;
    now?: Date;
    isPublished?: IsPublished;
    closedDates?: readonly string[];
  } = {},
) {
  return validateSubmission(
    draft,
    menu,
    options.config ?? config,
    options.now ?? wednesdayMorning,
    options.isPublished ?? published,
    options.closedDates ?? [],
  );
}

describe('normalisePhone — rule: accepted formats become the same E.164', () => {
  it('a phone in each accepted format normalises to the same E.164', () => {
    const expected = '+36301234567';
    expect(normalisePhone('06 30 123 4567')).toBe(expected);
    expect(normalisePhone('+36301234567')).toBe(expected);
    expect(normalisePhone('30/1234567')).toBe(expected);
  });

  it.each([
    ['+36 30 123 4567', '+36301234567'],
    ['+36 (30) 123-4567', '+36301234567'],
    ['0036 30 123 4567', '+36301234567'],
    ['06.30.123.4567', '+36301234567'],
    ['36301234567', '+36301234567'],
    ['3612345678', '+3612345678'],
    ['1 234 5678', '+3612345678'],
    ['06 22 123 456', '+3622123456'],
  ])('normalises %s to %s', (raw, e164) => {
    expect(normalisePhone(raw)).toBe(e164);
  });

  it.each([
    '',
    '   ',
    '+',
    'abc',
    '123',
    '+44 20 7946 0958',
    '0044 20 7946 0958',
    '06 12',
    '20123456',
  ])('rejects %j', (raw) => {
    expect(normalisePhone(raw)).toBeNull();
  });
});

describe('normaliseEmailKey', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmailKey('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
});

describe('isEmail — rule: RFC-ish, and the domain contains a dot', () => {
  it.each(['anna@example.hu', 'a.b+c@d.e.hu'])('accepts %s', (email) => {
    expect(isEmail(email)).toBe(true);
  });

  it.each(['a@b', 'not-an-email', 'a@b.', 'a@.com', 'a@@b.com', 'a@b..c'])(
    'rejects %s',
    (email) => {
      expect(isEmail(email)).toBe(false);
    },
  );
});

describe('orderMessagesHu', () => {
  it('has a Hungarian message for every stable error code', () => {
    expect(Object.keys(orderMessagesHu)).toEqual([...orderErrorCodes]);
    for (const code of orderErrorCodes) {
      expect(orderMessagesHu[code].length).toBeGreaterThan(0);
    }
  });

  it('shares the sold-out, variation, side and phone wording', () => {
    expect(orderMessagesHu.sold_out).toBe('Elfogyott.');
    expect(orderMessagesHu.variation_required).toBe('Válassz változatot.');
    expect(orderMessagesHu.side_required).toBe('Ehhez a főételhez köret jár.');
    expect(orderMessagesHu.invalid_phone).toBe('Ellenőrizd a telefonszámot.');
    expect(orderMessagesHu.cutoff_passed).toBe('Erre a napra már nem lehet rendelni.');
  });
});

describe('validateMenu — rule: five slots, variation, side, sold out, at least one item', () => {
  it('accepts a soup and a main whose price includes the soup', () => {
    expect(validateMenu({ soupId: 'soup', mainId: 'main-included' }, menu, WED)).toEqual({});
  });

  it('requires a variation exactly when the main has variations, and it must match one', () => {
    expect(validateMenu({ mainId: 'main-choice' }, menu, WED)).toEqual({
      variation: 'variation_required',
    });
    expect(validateMenu({ mainId: 'main-choice', variation: 'marha' }, menu, WED)).toEqual({
      variation: 'invalid_variation',
    });
    expect(validateMenu({ mainId: 'main-choice', variation: 'csirke' }, menu, WED)).toEqual({});
    expect(validateMenu({ mainId: 'main-included', variation: 'csirke' }, menu, WED)).toEqual({
      variation: 'not_allowed',
    });
    expect(validateMenu({ soupId: 'soup', variation: 'csirke' }, menu, WED)).toEqual({
      variation: 'not_allowed',
    });
  });

  it('does not check the variation when the main itself is unknown', () => {
    expect(validateMenu({ mainId: 'missing', variation: 'csirke' }, menu, WED)).toEqual({
      mainId: 'unknown_item',
    });
  });

  it('requires a side exactly when the main requires one, and forbids it otherwise', () => {
    expect(validateMenu({ mainId: 'main-side' }, menu, WED)).toEqual({ sideId: 'side_required' });
    expect(validateMenu({ mainId: 'main-side', sideId: 'missing' }, menu, WED)).toEqual({
      sideId: 'unknown_item',
    });
    expect(validateMenu({ mainId: 'main-side', sideId: 'side-sold' }, menu, WED)).toEqual({
      sideId: 'sold_out',
    });
    expect(validateMenu({ mainId: 'main-side', sideId: 'side' }, menu, WED)).toEqual({});
    expect(validateMenu({ mainId: 'main-side', sideId: 'side-extra' }, menu, WED)).toEqual({});
    expect(validateMenu({ mainId: 'main-included', sideId: 'side' }, menu, WED)).toEqual({
      sideId: 'not_allowed',
    });
    expect(validateMenu({ soupId: 'soup', sideId: 'side' }, menu, WED)).toEqual({
      sideId: 'not_allowed',
    });
  });

  it('sold-out main → sold_out', () => {
    expect(validateMenu({ mainId: 'main-sold' }, menu, WED)).toEqual({ mainId: 'sold_out' });
  });

  it('rejects an inactive item', () => {
    expect(validateMenu({ mainId: 'main-inactive' }, menu, WED)).toEqual({
      mainId: 'inactive',
      variation: 'variation_required',
    });
    expect(validateMenu({ dessertId: 'dessert-inactive' }, menu, WED)).toEqual({
      dessertId: 'inactive',
    });
  });

  it('takes soups and mains from that day, and mains also from featured and all-week', () => {
    expect(validateMenu({ mainId: 'main-monday' }, menu, WED)).toEqual({ mainId: 'unknown_item' });
    expect(validateMenu({ mainId: 'main-monday' }, menu, '2026-09-07')).toEqual({});
    expect(validateMenu({ soupId: 'soup' }, menu, '2026-09-13')).toEqual({
      soupId: 'unknown_item',
    });
    expect(validateMenu({ mainId: 'soup' }, menu, WED)).toEqual({ mainId: 'unknown_item' });
    expect(validateMenu({ mainId: 'featured' }, menu, WED)).toEqual({});
    expect(validateMenu({ mainId: 'all-week' }, menu, WED)).toEqual({});
    expect(validateMenu({ pickleId: 'pickle', dessertId: 'dessert' }, menu, WED)).toEqual({});
    expect(validateMenu({ pickleId: 'dessert' }, menu, WED)).toEqual({ pickleId: 'unknown_item' });
  });

  it('requires at least one item', () => {
    expect(validateMenu({}, menu, WED)).toEqual({ '': 'required' });
    expect(validateMenu({ soupId: '', mainId: '' }, menu, WED)).toEqual({ '': 'required' });
  });
});

describe('validateDay — rule: cutoff, fulfilment, extras; minimum is not an error', () => {
  it('accepts Wednesday morning for Wednesday through Saturday', () => {
    expect(validateDay(day(), menu, config, wednesdayMorning, published, [])).toEqual({});
    expect(
      validateDay(day({ deliveryDate: SAT }), menu, config, wednesdayMorning, published, []),
    ).toEqual({});
  });

  it.each([
    ['the cutoff minute closes today', bud(2026, 9, 9, 9, 30), WED],
    ['Friday after cutoff, Saturday has closed', bud(2026, 9, 11, 9, 31), SAT],
    ['Sunday is never orderable', wednesdayMorning, '2026-09-13'],
    ['a configured holiday is not orderable', wednesdayMorning, '2026-09-10'],
  ])('%s', (_name, now, deliveryDate) => {
    const closedDates = deliveryDate === '2026-09-10' ? ['2026-09-10'] : [];
    expect(
      validateDay(day({ deliveryDate }), menu, config, now, published, closedDates).deliveryDate,
    ).toBe('cutoff_passed');
  });

  it('Friday before cutoff still accepts Saturday', () => {
    expect(
      validateDay(day({ deliveryDate: SAT }), menu, config, bud(2026, 9, 11, 9, 29), published, []),
    ).toEqual({});
  });

  it('rejects a day when the week is not published, including a rolled-over next week', () => {
    const closed = () => false;
    expect(validateDay(day(), menu, config, wednesdayMorning, closed, []).deliveryDate).toBe(
      'cutoff_passed',
    );
    expect(
      validateDay(
        day({ deliveryDate: '2026-09-14' }),
        menu,
        config,
        bud(2026, 9, 11, 9, 31),
        closed,
        [],
      ).deliveryDate,
    ).toBe('cutoff_passed');
  });

  it('rejects a delivery date that is not a calendar day', () => {
    expect(
      validateDay(
        day({ deliveryDate: '2026-02-31', menus: [{ dessertId: 'dessert' }] }),
        menu,
        config,
        wednesdayMorning,
        published,
        [],
      ),
    ).toEqual({ deliveryDate: 'invalid' });
    expect(
      validateDay(
        day({ deliveryDate: 'holnap', menus: [{ dessertId: 'dessert' }] }),
        menu,
        config,
        wednesdayMorning,
        published,
        [],
      ),
    ).toEqual({ deliveryDate: 'invalid' });
  });

  it('rejects pickup when it is disabled, and an unknown fulfilment', () => {
    expect(
      validateDay(day({ fulfilment: 'pickup' }), menu, config, wednesdayMorning, published, []),
    ).toEqual({ fulfilment: 'pickup_disabled' });
    expect(
      validateDay(
        day({ fulfilment: 'courier' as DayDraft['fulfilment'] }),
        menu,
        config,
        wednesdayMorning,
        published,
        [],
      ),
    ).toEqual({ fulfilment: 'invalid' });
  });

  it('accepts pickup when pickupEnabled, with no address required at submission', () => {
    expect(
      validateDay(day({ fulfilment: 'pickup' }), menu, pickupOn, wednesdayMorning, published, []),
    ).toEqual({});
  });

  it('requires at least one menu, and prefixes menu errors', () => {
    expect(
      validateDay(day({ menus: [] }), menu, config, wednesdayMorning, published, []).menus,
    ).toBe('required');
    expect(
      validateDay(
        day({ menus: [{}, { mainId: 'main-choice' }] }),
        menu,
        config,
        wednesdayMorning,
        published,
        [],
      ),
    ).toMatchObject({
      'menus.0': 'required',
      'menus.1.variation': 'variation_required',
    });
  });

  it('checks extra keys and quantities 1..20, and ignores the minimum', () => {
    const pricedUnderMinimum = day({
      menus: [{ mainId: 'main-2199' }],
      extras: [
        { key: 'kenyer', quantity: 1 },
        { key: 'kenyer', quantity: 20 },
        { key: 'nincs', quantity: 0 },
        { key: 'ketchup', quantity: 1.5 },
        { key: 'tartarmartas', quantity: 21 },
      ],
    });
    expect(validateDay(pricedUnderMinimum, menu, config, wednesdayMorning, published, [])).toEqual({
      'extras.1.key': 'duplicate',
      'extras.2.key': 'unknown_extra',
      'extras.2.quantity': 'invalid_quantity',
      'extras.3.quantity': 'invalid_quantity',
      'extras.4.quantity': 'invalid_quantity',
    });
    expect(
      validateDay(
        day({ menus: [{ mainId: 'main-2199' }], extras: [{ key: 'doboz', quantity: 1 }] }),
        menu,
        config,
        wednesdayMorning,
        published,
        [],
      ),
    ).toEqual({});
  });
});

describe('validateSubmission — rule: checkout fields, 1..7 unique days', () => {
  it('accepts a delivery order, including each phone format', () => {
    expect(errorsOf(submission())).toEqual({});
    for (const phone of ['06 30 123 4567', '+36301234567', '30/1234567']) {
      expect(errorsOf(submission({ phone }))).toEqual({});
    }
    expect(errorsOf(submission({ email: '  Anna@Example.HU  ', name: '  Anna  ' }))).toEqual({});
  });

  it('checks name, phone and email', () => {
    expect(errorsOf(submission({ name: '   ', phone: '   ', email: '   ' }))).toMatchObject({
      name: 'required',
      phone: 'required',
      email: 'required',
    });
    expect(errorsOf(submission({ name: 'A' }))).toMatchObject({ name: 'too_short' });
    expect(errorsOf(submission({ name: 'A'.repeat(81) }))).toMatchObject({ name: 'too_long' });
    expect(errorsOf(submission({ name: 'Al' })).name).toBeUndefined();
    expect(errorsOf(submission({ name: 'A'.repeat(80) })).name).toBeUndefined();
    expect(errorsOf(submission({ phone: '123' }))).toMatchObject({ phone: 'invalid_phone' });
    expect(errorsOf(submission({ email: 'a@b' }))).toMatchObject({ email: 'invalid_email' });
  });

  it('requires an address of 5..200 characters for delivery, not for pickup', () => {
    expect(errorsOf(submission({ address: undefined }))).toMatchObject({ address: 'required' });
    expect(errorsOf(submission({ address: '    ' }))).toMatchObject({ address: 'required' });
    expect(errorsOf(submission({ address: 'Abcd' }))).toMatchObject({ address: 'too_short' });
    expect(errorsOf(submission({ address: 'Abcde' })).address).toBeUndefined();
    expect(errorsOf(submission({ address: 'A'.repeat(200) })).address).toBeUndefined();
    expect(errorsOf(submission({ address: 'A'.repeat(201) }))).toMatchObject({
      address: 'too_long',
    });

    const pickup = day({ fulfilment: 'pickup', menus: [{ mainId: 'main-500' }] });
    expect(
      errorsOf(submission({ address: undefined, days: [pickup] }), { config: pickupOn }),
    ).toEqual({});
    expect(
      errorsOf(submission({ address: 'Ab', days: [pickup] }), { config: pickupOn }),
    ).toMatchObject({
      address: 'too_short',
    });
    expect(
      errorsOf(
        submission({
          address: undefined,
          days: [pickup, day()],
        }),
        { config: pickupOn },
      ),
    ).toMatchObject({ address: 'required' });
  });

  it('allows 1..7 unique days and rejects none, more than 7, and a repeated date', () => {
    expect(errorsOf(submission({ days: [] }))).toMatchObject({ days: 'required' });
    expect(errorsOf(submission({ days: [], address: undefined })).address).toBeUndefined();

    const week = ['2026-09-07', '2026-09-08', WED, '2026-09-10', '2026-09-11', SAT, '2026-09-13'];
    const seven = errorsOf(submission({ days: week.map((deliveryDate) => day({ deliveryDate })) }));
    expect(seven.days).toBeUndefined();

    const eight = errorsOf(
      submission({
        days: [...week, '2026-09-14'].map((deliveryDate) => day({ deliveryDate })),
      }),
    );
    expect(eight.days).toBe('too_many');

    const duplicated = errorsOf(
      submission({
        days: [day({ deliveryDate: '2026-09-07' }), day({ deliveryDate: '2026-09-07' })],
      }),
    );
    expect(duplicated['days.0.deliveryDate']).toBe('cutoff_passed');
    expect(duplicated['days.1.deliveryDate']).toBe('duplicate');
  });

  it('numbers menus in the day and reports a dotted path for the second menu', () => {
    const result = errorsOf(
      submission({
        days: [
          day({
            menus: [{ soupId: 'soup', mainId: 'main-included' }, { mainId: 'main-choice' }],
          }),
        ],
      }),
    );
    expect(result).toEqual({ 'days.0.menus.1.variation': 'variation_required' });
  });

  it('delivery food subtotal 2199 is valid', () => {
    expect(errorsOf(submission({ days: [day({ menus: [{ mainId: 'main-2199' }] })] }))).toEqual({});
  });

  it('keeps an optional note without validating it', () => {
    expect(errorsOf(submission({ note: undefined }))).toEqual({});
    expect(errorsOf(submission({ note: 'x'.repeat(500) }))).toEqual({});
  });
});

describe('priceMenu — rule: soup adjustment and weekday/weekend price by delivery date', () => {
  it('soup only → 650', () => {
    expect(priceMenu({ soupId: 'soup' }, menu, WED, config)).toEqual({
      items: [{ slot: 'soup', itemId: 'soup', name: 'Húsleves', unitPrice: 0 }],
      adjustments: [{ code: 'soup_charge', amount: 650 }],
      price: 650,
    });
  });

  it('main(1020, soupIncluded) without soup → 920', () => {
    expect(priceMenu({ mainId: 'main-included' }, menu, WED, config)).toEqual({
      items: [{ slot: 'main', itemId: 'main-included', name: 'Rántott szelet', unitPrice: 1020 }],
      adjustments: [{ code: 'no_soup_discount', amount: -100 }],
      price: 920,
    });
  });

  it('main(1020, soupIncluded) + soup → 1020', () => {
    expect(priceMenu({ soupId: 'soup', mainId: 'main-included' }, menu, WED, config)).toEqual({
      items: [
        { slot: 'soup', itemId: 'soup', name: 'Húsleves', unitPrice: 0 },
        { slot: 'main', itemId: 'main-included', name: 'Rántott szelet', unitPrice: 1020 },
      ],
      adjustments: [],
      price: 1020,
    });
  });

  it('main(1450, soupIncluded=false) + soup → 2100', () => {
    expect(priceMenu({ soupId: 'soup', mainId: 'main-side' }, menu, WED, config)).toEqual({
      items: [
        { slot: 'soup', itemId: 'soup', name: 'Húsleves', unitPrice: 0 },
        { slot: 'main', itemId: 'main-side', name: 'Főzelék', unitPrice: 1450 },
      ],
      adjustments: [{ code: 'soup_charge', amount: 650 }],
      price: 2100,
    });
  });

  it('does not discount a main whose price excludes the soup when no soup is chosen', () => {
    expect(priceMenu({ mainId: 'main-side' }, menu, WED, config).price).toBe(1450);
    expect(priceMenu({ mainId: 'main-side' }, menu, WED, config).adjustments).toEqual([]);
  });

  it('Saturday delivery ordered on Wednesday uses the weekend price', () => {
    expect(
      validateDay(day({ deliveryDate: SAT }), menu, config, wednesdayMorning, published, []),
    ).toEqual({});
    const priced = priceMenu({ soupId: 'soup', mainId: 'main-included' }, menu, SAT, config);
    expect(priced.items[1]?.unitPrice).toBe(1800);
    expect(priced.price).toBe(1800);
    const sideLine = priceMenu(
      { mainId: 'main-side', sideId: 'side', dessertId: 'dessert' },
      menu,
      SAT,
      config,
    );
    expect(sideLine.items.map((line) => [line.slot, line.unitPrice])).toEqual([
      ['main', 1600],
      ['side', 350],
      ['dessert', 600],
    ]);
  });

  it('prices featured and all-week mains, a side extra, and skips unknown ids', () => {
    expect(priceMenu({ mainId: 'featured' }, menu, '2026-09-13', config).price).toBe(1900);
    expect(priceMenu({ mainId: 'all-week' }, menu, WED, config).price).toBe(1700);
    expect(priceMenu({ mainId: 'main-side', sideId: 'side-extra' }, menu, WED, config).price).toBe(
      1900,
    );
    expect(priceMenu({ soupId: 'missing', mainId: 'missing' }, menu, WED, config)).toEqual({
      items: [],
      adjustments: [],
      price: 0,
    });
  });

  it('snapshots a variation only when it is one of the main choices', () => {
    const chosen = priceMenu({ mainId: 'main-choice', variation: 'csirke' }, menu, WED, config);
    expect(chosen.items[0]).toMatchObject({ slot: 'main', variation: 'csirke', unitPrice: 1100 });
    expect(chosen.price).toBe(1000);
    const rejected = priceMenu({ mainId: 'main-choice', variation: 'marha' }, menu, WED, config);
    expect(rejected.items[0]).not.toHaveProperty('variation');
    expect(priceMenu({ pickleId: 'pickle' }, menu, WED, config).price).toBe(200);
  });
});

describe('priceDay and priceSubmission — rule: extras, fee, minimum', () => {
  it('delivery food subtotal 2199 → missingToMinimum 1, and 2200 → 0', () => {
    const under = priceDay(day({ menus: [{ mainId: 'main-2199' }] }), menu, config);
    expect(under.foodSubtotal).toBe(2199);
    expect(under.missingToMinimum).toBe(1);
    expect(under.deliveryFee).toBe(150);
    expect(under.total).toBe(2349);

    const exact = priceDay(day({ menus: [{ mainId: 'main-2200' }] }), menu, config);
    expect(exact.foodSubtotal).toBe(2200);
    expect(exact.missingToMinimum).toBe(0);
    expect(exact.total).toBe(2350);
  });

  it('extras count toward the minimum and the delivery fee is excluded from it', () => {
    const alone = priceDay(day({ menus: [{ mainId: 'main-2099' }] }), menu, config);
    expect(alone.missingToMinimum).toBe(101);

    const withExtras = priceDay(
      day({
        menus: [{ mainId: 'main-2099' }],
        extras: [
          { key: 'doboz', quantity: 1 },
          { key: 'ketchup', quantity: 1 },
          { key: 'tartarmartas', quantity: 2 },
          { key: 'nincs', quantity: 4 },
        ],
      }),
      menu,
      config,
    );
    expect(withExtras.extras).toEqual([
      { key: 'doboz', name: 'Doboz', quantity: 1, unitPrice: 100, total: 100 },
      { key: 'ketchup', name: 'Ketchup', quantity: 1, unitPrice: 400, total: 400 },
      { key: 'tartarmartas', name: 'Tartármártás', quantity: 2, unitPrice: 400, total: 800 },
    ]);
    expect(withExtras.foodSubtotal).toBe(2099 + 100 + 400 + 800);
    expect(withExtras.missingToMinimum).toBe(0);
    expect(withExtras.deliveryFee).toBe(150);
    expect(withExtras.total).toBe(withExtras.foodSubtotal + 150);
  });

  it('pickup 500 is priced with no fee and no minimum when pickup is enabled', () => {
    const pickup = day({ fulfilment: 'pickup', menus: [{ mainId: 'main-500' }] });
    expect(
      errorsOf(submission({ address: undefined, days: [pickup] }), { config: pickupOn }),
    ).toEqual({});
    const priced = priceDay(pickup, menu, pickupOn);
    expect(priced.foodSubtotal).toBe(500);
    expect(priced.deliveryFee).toBe(0);
    expect(priced.total).toBe(500);
    expect(priced.missingToMinimum).toBe(0);
  });

  it('fulfilment pickup is rejected when pickup is disabled', () => {
    expect(
      errorsOf(submission({ days: [day({ fulfilment: 'pickup' })] })).fulfilment,
    ).toBeUndefined();
    expect(
      errorsOf(submission({ days: [day({ fulfilment: 'pickup' })] }))['days.0.fulfilment'],
    ).toBe('pickup_disabled');
  });

  it('sums several menus in a day and several days in a submission, in whole forints', () => {
    const grouped = priceDay(
      day({
        menus: [
          { soupId: 'soup', mainId: 'main-included' },
          { soupId: 'soup' },
          { pickleId: 'pickle', dessertId: 'dessert' },
        ],
        extras: [{ key: 'kenyer', quantity: 2 }],
      }),
      menu,
      config,
    );
    expect(grouped.menus.map((entry) => entry.price)).toEqual([1020, 650, 700]);
    expect(grouped.extras[0]?.total).toBe(100);
    expect(grouped.foodSubtotal).toBe(1020 + 650 + 700 + 100);

    const priced = priceSubmission(
      submission({
        days: [day(), day({ deliveryDate: SAT })],
      }),
      menu,
      config,
    );
    expect(priced.days).toHaveLength(2);
    expect(priced.days[0]?.foodSubtotal).toBe(1020);
    expect(priced.days[1]?.foodSubtotal).toBe(1800);
    expect(priced.foodSubtotal).toBe(2820);
    expect(priced.deliveryFee).toBe(300);
    expect(priced.total).toBe(3120);
    for (const value of [priced.foodSubtotal, priced.deliveryFee, priced.total]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
