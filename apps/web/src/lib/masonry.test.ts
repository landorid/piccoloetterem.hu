import { describe, expect, it } from 'vitest';
import { rowSpan } from './masonry';

describe('rowSpan', () => {
  it('covers the height and the gap below it in whole rows', () => {
    expect(rowSpan(100, 32, 4)).toBe(33);
    expect(rowSpan(101, 32, 4)).toBe(34);
  });

  it('spans at least one row for an empty block', () => {
    expect(rowSpan(0, 0, 4)).toBe(1);
  });
});
