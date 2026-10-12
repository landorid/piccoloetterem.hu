import { describe, expect, it } from 'vitest';
import { itemImageUrl } from './index';

const item = {
  id: '00000000-0000-4000-8000-000000000107',
  imageVersion: '7d3f0c52-58a1-4b1e-9a43-0d9a1c3e2b10',
};

describe('itemImageUrl', () => {
  it('names the item, its version and the rendition under the API origin', () => {
    expect(itemImageUrl('http://localhost:8787', item, 'thumb')).toBe(
      `http://localhost:8787/api/images/${item.id}/${item.imageVersion}/thumb`,
    );
    expect(itemImageUrl('https://api-dev.piccoloetterem.hu', item, 'large')).toBe(
      `https://api-dev.piccoloetterem.hu/api/images/${item.id}/${item.imageVersion}/large`,
    );
  });

  it('is null for an item without an image, or without an API origin', () => {
    expect(itemImageUrl('http://localhost:8787', { id: item.id }, 'thumb')).toBeNull();
    expect(itemImageUrl(undefined, item, 'thumb')).toBeNull();
    expect(itemImageUrl('', item, 'thumb')).toBeNull();
  });
});
