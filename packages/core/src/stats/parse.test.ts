import { describe, expect, it } from 'vitest';
import { customerRef, dishKey } from './keys';
import { LegacyStatsFileError, parseLegacyStatsFile } from './parse';
import type { LegacyStatsFile } from './types';

/** Invented data; the real file never enters the repository. */
function validFile(): LegacyStatsFile {
  return {
    formatVersion: 1,
    generatedAt: '2026-11-02T08:00:00.000Z',
    span: { from: '2017-05-02', to: '2026-10-31' },
    closedDays: ['2017-05-06'],
    daily: [
      {
        date: '2017-05-02',
        orderDays: 3,
        revenue: 4500,
        menus: 4,
        groupOrderDays: 1,
        mains: 4,
        mainsWithSoup: 3,
        mainsWithSide: 1,
        mainsWithDessert: 0,
      },
    ],
    dishes: [
      {
        dishKey: dishKey('Rántott sertésszelet'),
        name: 'Rántott sertésszelet',
        slot: 'main',
        date: '2017-05-02',
        portions: 2,
        variations: {},
      },
      {
        dishKey: dishKey('Gyümölcsleves'),
        name: 'Gyümölcsleves',
        slot: 'soup',
        date: '2017-05-02',
        portions: 3,
        variations: { hideg: 2, meleg: 1 },
      },
    ],
    monthlyActive: [{ month: '2017-05', customers: 3 }],
    customers: [
      {
        ref: customerRef('teszt.elek@example.hu'),
        emailKey: 'teszt.elek@example.hu',
        name: 'Teszt Elek',
        email: 'Teszt.Elek@example.hu',
        phone: '+36301234567',
        address: null,
        orderDates: ['2017-05-02', '2017-05-03'],
        monthlySpend: { '2017-05': 3000 },
        weekdayCounts: [0, 1, 1, 0, 0, 0],
        menus: 2,
        groupOrderDays: 0,
        topDishes: [
          { dishKey: dishKey('Rántott sertésszelet'), name: 'Rántott sertésszelet', count: 2 },
        ],
        lastOrders: [{ date: '2017-05-03', items: 'Rántott sertésszelet', menus: 1, total: 1500 }],
      },
    ],
  };
}

// biome-ignore lint/suspicious/noExplicitAny: the tests break the file's shape on purpose
type Loose = Record<string, any>;

/** A deep copy of the valid file, changed by `mutate`. */
function broken(mutate: (file: Loose) => void): unknown {
  const file = structuredClone(validFile()) as Loose;
  mutate(file);
  return file;
}

function errorOf(json: unknown): LegacyStatsFileError {
  try {
    parseLegacyStatsFile(json);
  } catch (error) {
    if (error instanceof LegacyStatsFileError) {
      return error;
    }
    throw error;
  }
  throw new Error('parseLegacyStatsFile accepted the file');
}

describe('parseLegacyStatsFile', () => {
  it('accepts a valid file and returns it', () => {
    const file = validFile();
    expect(parseLegacyStatsFile(file)).toBe(file);
  });

  it('accepts empty lists', () => {
    const file = { ...validFile(), closedDays: [], daily: [], dishes: [], customers: [] };
    expect(parseLegacyStatsFile(file)).toBe(file);
  });

  it.each<[string, unknown, string]>([
    ['not an object', 'stats', '$'],
    ['null', null, '$'],
    ['an array', [], '$'],
    ['another format version', broken((f) => (f.formatVersion = 2)), '$.formatVersion'],
    ['a missing format version', broken((f) => delete f.formatVersion), '$.formatVersion'],
    ['a numeric generatedAt', broken((f) => (f.generatedAt = 1)), '$.generatedAt'],
    ['an unparsable generatedAt', broken((f) => (f.generatedAt = 'tegnap')), '$.generatedAt'],
    ['a missing span', broken((f) => delete f.span), '$.span'],
    ['a bad span start', broken((f) => (f.span.from = '2017-02-30')), '$.span.from'],
    ['an inverted span', broken((f) => (f.span.to = '2017-01-01')), '$.span.to'],
    ['closedDays not a list', broken((f) => (f.closedDays = '2017-05-06')), '$.closedDays'],
    ['a bad closed day', broken((f) => (f.closedDays[0] = '2017-5-6')), '$.closedDays[0]'],
    ['a bad daily date', broken((f) => (f.daily[0].date = 20170502)), '$.daily[0].date'],
    ['a missing daily count', broken((f) => delete f.daily[0].mains), '$.daily[0].mains'],
    ['a negative revenue', broken((f) => (f.daily[0].revenue = -1)), '$.daily[0].revenue'],
    ['a fractional revenue', broken((f) => (f.daily[0].revenue = 1.5)), '$.daily[0].revenue'],
    ['a string count', broken((f) => (f.daily[0].menus = '4')), '$.daily[0].menus'],
    ['a dish row that is not an object', broken((f) => (f.dishes[1] = 'leves')), '$.dishes[1]'],
    [
      'a dish key that is not the name’s',
      broken((f) => (f.dishes[0].dishKey = 'x')),
      '$.dishes[0].dishKey',
    ],
    [
      'an empty dish key',
      broken((f) => {
        f.dishes[0].name = '-';
        f.dishes[0].dishKey = '';
      }),
      '$.dishes[0].dishKey',
    ],
    ['a missing dish name', broken((f) => delete f.dishes[0].name), '$.dishes[0].name'],
    ['an unknown slot', broken((f) => (f.dishes[0].slot = 'drink')), '$.dishes[0].slot'],
    ['a bad dish date', broken((f) => (f.dishes[0].date = '')), '$.dishes[0].date'],
    [
      'a negative portion count',
      broken((f) => (f.dishes[0].portions = -2)),
      '$.dishes[0].portions',
    ],
    [
      'variations as a list',
      broken((f) => (f.dishes[1].variations = [])),
      '$.dishes[1].variations',
    ],
    [
      'an empty variation name',
      broken((f) => (f.dishes[1].variations = { '': 1 })),
      '$.dishes[1].variations',
    ],
    [
      'a bad variation count',
      broken((f) => (f.dishes[1].variations.hideg = null)),
      '$.dishes[1].variations',
    ],
    [
      'a bad month',
      broken((f) => (f.monthlyActive[0].month = '2017-13')),
      '$.monthlyActive[0].month',
    ],
    [
      'a numeric month',
      broken((f) => (f.monthlyActive[0].month = 201705)),
      '$.monthlyActive[0].month',
    ],
    [
      'a bad active count',
      broken((f) => (f.monthlyActive[0].customers = -1)),
      '$.monthlyActive[0].customers',
    ],
    ['customers not a list', broken((f) => (f.customers = {})), '$.customers'],
    [
      'a missing email key',
      broken((f) => delete f.customers[0].emailKey),
      '$.customers[0].emailKey',
    ],
    [
      'a ref that is not the email key’s',
      broken((f) => (f.customers[0].ref = '0000000000000000')),
      '$.customers[0].ref',
    ],
    ['a missing name', broken((f) => delete f.customers[0].name), '$.customers[0].name'],
    ['a missing email', broken((f) => delete f.customers[0].email), '$.customers[0].email'],
    [
      'a numeric phone',
      broken((f) => (f.customers[0].phone = 36301234567)),
      '$.customers[0].phone',
    ],
    ['a missing address', broken((f) => delete f.customers[0].address), '$.customers[0].address'],
    [
      'a bad order date',
      broken((f) => (f.customers[0].orderDates[1] = '2017-05-32')),
      '$.customers[0].orderDates[1]',
    ],
    [
      'unsorted order dates',
      broken((f) => f.customers[0].orderDates.reverse()),
      '$.customers[0].orderDates[1]',
    ],
    [
      'a repeated order date',
      broken((f) => (f.customers[0].orderDates[1] = '2017-05-02')),
      '$.customers[0].orderDates[1]',
    ],
    [
      'a bad spend month',
      broken((f) => (f.customers[0].monthlySpend = { '2017-5': 1 })),
      '$.customers[0].monthlySpend',
    ],
    [
      'a bad spend',
      broken((f) => (f.customers[0].monthlySpend['2017-05'] = 'sok')),
      '$.customers[0].monthlySpend.2017-05',
    ],
    [
      'seven weekday counts',
      broken((f) => f.customers[0].weekdayCounts.push(0)),
      '$.customers[0].weekdayCounts',
    ],
    [
      'a bad weekday count',
      broken((f) => (f.customers[0].weekdayCounts[5] = -1)),
      '$.customers[0].weekdayCounts[5]',
    ],
    ['a bad menu count', broken((f) => (f.customers[0].menus = 2.5)), '$.customers[0].menus'],
    [
      'a bad group count',
      broken((f) => delete f.customers[0].groupOrderDays),
      '$.customers[0].groupOrderDays',
    ],
    [
      'eleven top dishes',
      broken((f) => {
        f.customers[0].topDishes = Array(11).fill(f.customers[0].topDishes[0]);
      }),
      '$.customers[0].topDishes',
    ],
    [
      'a top dish with a bad key',
      broken((f) => (f.customers[0].topDishes[0].dishKey = 'leves')),
      '$.customers[0].topDishes[0].dishKey',
    ],
    [
      'a top dish with a bad count',
      broken((f) => (f.customers[0].topDishes[0].count = 0.5)),
      '$.customers[0].topDishes[0].count',
    ],
    [
      'eleven last orders',
      broken((f) => {
        f.customers[0].lastOrders = Array(11).fill(f.customers[0].lastOrders[0]);
      }),
      '$.customers[0].lastOrders',
    ],
    [
      'a last order that is not an object',
      broken((f) => (f.customers[0].lastOrders[0] = null)),
      '$.customers[0].lastOrders[0]',
    ],
    [
      'a last order with a bad date',
      broken((f) => (f.customers[0].lastOrders[0].date = 'ma')),
      '$.customers[0].lastOrders[0].date',
    ],
    [
      'a last order without items',
      broken((f) => delete f.customers[0].lastOrders[0].items),
      '$.customers[0].lastOrders[0].items',
    ],
    [
      'a last order with a bad menu count',
      broken((f) => (f.customers[0].lastOrders[0].menus = -1)),
      '$.customers[0].lastOrders[0].menus',
    ],
    [
      'a last order with a bad total',
      broken((f) => (f.customers[0].lastOrders[0].total = '1500')),
      '$.customers[0].lastOrders[0].total',
    ],
  ])('rejects %s at its path', (_, json, path) => {
    const error = errorOf(json);
    expect(error.path).toBe(path);
    expect(error.message).toMatch(
      new RegExp(`^Invalid legacy stats file at ${escapeRegExp(path)}: expected `),
    );
  });

  it('never puts a value into the message', () => {
    const secret = 'titkos.vevo@example.hu';
    for (const json of [
      broken((f) => (f.closedDays[0] = secret)),
      broken((f) => (f.customers[0].phone = { secret })),
      broken((f) => (f.customers[0].emailKey = secret)),
      broken((f) => (f.customers[0].orderDates[0] = secret)),
      broken((f) => (f.customers[0].monthlySpend = { [secret]: 1 })),
      broken((f) => (f.dishes[1].variations = { [secret]: -1 })),
    ]) {
      const error = errorOf(json);
      expect(error.message).not.toContain('titkos');
      expect(error.path).not.toContain('titkos');
    }
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\$]/g, '\\$&');
}
