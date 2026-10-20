import { describe, expect, it } from 'vitest';
import { imageVersions, menuWithImage } from './model';

const version = '7d3f0c52-58a1-4b1e-9a43-0d9a1c3e2b10';
const menu = {
  allWeek: [],
  desserts: [
    { id: 'a', name: 'Palacsinta' },
    { id: 'b', name: 'Somlói', imageVersion: version },
  ],
  pickles: [],
  sides: [],
  sideExtras: [],
};

describe('imageVersions', () => {
  it('maps the items that have an image to their version', () => {
    expect([...imageVersions(menu)]).toEqual([['b', version]]);
    expect(imageVersions(undefined).size).toBe(0);
  });
});

describe('menuWithImage', () => {
  it("sets one item's image and leaves the others alone", () => {
    const next = menuWithImage(menu, 'a', version);
    expect(next.desserts).toEqual([
      { id: 'a', name: 'Palacsinta', imageVersion: version },
      menu.desserts[1],
    ]);
  });

  it('removes the key itself, so the item equals what the API sends without an image', () => {
    expect(menuWithImage(menu, 'b', undefined).desserts[1]).toEqual({ id: 'b', name: 'Somlói' });
  });
});
