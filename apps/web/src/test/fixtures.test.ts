import { allergenCodes, loadConfig, weekLabel } from '@piccolo/core';
import { describe, expect, it } from 'vitest';
import { openMenu, publicConfig } from './fixtures';

describe('the test fixture', () => {
  it("is Piccolo's public config, as GET /api/config/public serves it", () => {
    const { name, contact, pickupEnabled, pricing, extras } = loadConfig({ RESTAURANT: 'piccolo' });
    expect(publicConfig).toEqual({ name, contact, pickupEnabled, pricing, extras });
  });

  it('labels its week the way core does', () => {
    const { operatingDays } = loadConfig({ RESTAURANT: 'piccolo' });
    expect(openMenu.weekLabel).toBe(weekLabel(2026, 37, { operatingDays }));
    expect(openMenu.menu.weekLabel).toBe(openMenu.weekLabel);
  });

  it('gives every dish known allergen codes and a unique id', () => {
    const { days, featured, permanent } = openMenu.menu;
    const items = [
      ...Object.values(days).flatMap((day) => [...day.soups, ...day.mains]),
      ...featured,
      ...Object.values(permanent).flat(),
    ];
    for (const item of items) {
      expect(item.allergens.every((code) => allergenCodes.includes(code))).toBe(true);
    }
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
