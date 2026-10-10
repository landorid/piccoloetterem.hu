import { describe, expect, it } from 'vitest';
import { forint } from './format';

describe('forint', () => {
  it('writes forints the Hungarian way, grouping from five digits', () => {
    expect(forint(0)).toBe('0 Ft');
    expect(forint(650)).toBe('650 Ft');
    expect(forint(2200)).toBe('2200 Ft');
    expect(forint(10400)).toMatch(/^10[  ]400 Ft$/);
  });

  it('writes a negative amount with a minus sign, not a hyphen', () => {
    expect(forint(-100)).toBe('−100 Ft');
    expect(forint(-10400)).toMatch(/^−10[  ]400 Ft$/);
  });
});
