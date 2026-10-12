import type { menuItems } from '@piccolo/db';
import { describe, expect, it } from 'vitest';
import { toMenuItem } from './repo';

const row: typeof menuItems.$inferSelect = {
  id: '00000000-0000-4000-8000-000000000107',
  category: 'dessert',
  name: 'Túrós palacsinta',
  description: null,
  priceWeekday: 690,
  priceWeekend: null,
  variations: [],
  allergens: ['gluten', 'eggs', 'milk'],
  soupIncluded: false,
  requiresSide: false,
  soldOut: false,
  active: true,
  sortOrder: 0,
  imageVersion: null,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
};

describe('toMenuItem', () => {
  it('maps image_version to imageVersion', () => {
    const imageVersion = '7d3f0c52-58a1-4b1e-9a43-0d9a1c3e2b10';
    expect(toMenuItem({ ...row, imageVersion }).imageVersion).toBe(imageVersion);
  });

  it('leaves the key out when the item has no image, so its JSON is unchanged', () => {
    expect(Object.keys(toMenuItem(row))).not.toContain('imageVersion');
  });
});
