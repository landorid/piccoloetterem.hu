import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './load';

describe('loadConfig', () => {
  afterEach(() => {
    vi.doUnmock('./piccolo');
    vi.resetModules();
  });

  it('returns the Piccolo config', () => {
    const config = loadConfig({ RESTAURANT: 'piccolo' });
    expect(config.name).toBe('Piccolo Club Étterem');
    expect(config.timezone).toBe('Europe/Budapest');
  });

  it.each([{}, { RESTAURANT: '' }])('throws when RESTAURANT is not set (%o)', (env) => {
    expect(() => loadConfig(env)).toThrow('RESTAURANT is not set. Set it to one of: piccolo.');
  });

  it.each(['pizzeria', 'Piccolo', 'toString', '__proto__'])('throws on unknown key "%s"', (key) => {
    expect(() => loadConfig({ RESTAURANT: key })).toThrow(
      `Unknown RESTAURANT "${key}". Expected one of: piccolo.`,
    );
  });

  it('rejects a config whose intake window does not end at the cutoff', async () => {
    vi.doMock('./piccolo', async (importOriginal) => {
      const { piccolo } = await importOriginal<typeof import('./piccolo')>();
      return {
        piccolo: {
          ...piccolo,
          contact: { ...piccolo.contact, intakeWindow: { from: '07:30', until: '10:00' } },
        },
      };
    });
    vi.resetModules();
    const { loadConfig: loadMocked } = await import('./load');
    expect(() => loadMocked({ RESTAURANT: 'piccolo' })).toThrow(
      'RestaurantConfig "piccolo": contact.intakeWindow.until (10:00) must equal cutoff (09:30).',
    );
  });
});

describe('the Piccolo instance', () => {
  const config = loadConfig({ RESTAURANT: 'piccolo' });

  it('carries the values the order page needs', () => {
    expect(config.cutoff).toBe('09:30');
    expect(config.operatingDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(config.pricing).toEqual({
      noSoupDiscount: 100,
      soupPrice: 650,
      deliveryFee: 150,
      minimumOrder: 2200,
    });
    expect(config.extras.map((extra) => extra.key)).toEqual([
      'doboz',
      'kenyer',
      'ketchup',
      'tartarmartas',
    ]);
    expect(config.pickupEnabled).toBe(false);
    expect(config.messages.nextWeekNotPublished).toMatch(/vasárnap este vagy hétfő reggel/);
    expect(config.messages.emptyWeek).toBe(
      'Amint elkészül a heti menü, itt azonnal látni fogod. Telefonon addig is szívesen segítünk.',
    );
    expect(config.contact.openingHours).toBe('Hétfő–szombat 11:00–16:00');
    expect(config.contact.intakeWindow).toEqual({ from: '07:30', until: config.cutoff });
  });

  it('lists the Hungarian public holidays of 2026 and 2027', () => {
    const fixed = (year: number) =>
      ['01-01', '03-15', '05-01', '08-20', '10-23', '11-01', '12-25', '12-26'].map(
        (md) => `${year}-${md}`,
      );
    const moveable = (year: number) => {
      const easter = easterSunday(year);
      return [-2, 1, 50].map((offset) =>
        new Date(easter + offset * 86_400_000).toISOString().slice(0, 10),
      );
    };
    const expected = [2026, 2027].flatMap((year) => [...fixed(year), ...moveable(year)]).sort();
    expect([...config.holidays].sort()).toEqual(expected);
  });
});

/** Easter Sunday (Gregorian) as a UTC timestamp — the anonymous Gregorian algorithm. */
function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day);
}
