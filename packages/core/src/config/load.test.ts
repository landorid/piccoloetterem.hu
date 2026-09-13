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
    expect(config.lastSameWeekOrderDay).toBe(5);
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
    expect(config.contact.openingHours).toBe('Hétfő–szombat 11:00–16:00');
    expect(config.contact.intakeWindow).toEqual({ from: '07:30', until: config.cutoff });
  });
});
