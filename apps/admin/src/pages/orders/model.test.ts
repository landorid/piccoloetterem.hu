import { describe, expect, it } from 'vitest';
import { changedOrderIds, formatAmount, moveSelection, parseStatusFilter } from './model';

describe('parseStatusFilter', () => {
  it.each([
    ['received', 'received'],
    ['processed', 'processed'],
    ['cancelled', 'cancelled'],
    ['all', 'all'],
    [null, 'all'],
    ['new', 'all'],
  ] as const)('%s → %s', (value, expected) => {
    expect(parseStatusFilter(value)).toBe(expected);
  });
});

describe('changedOrderIds', () => {
  const previous = new Map([
    ['a', 'received'],
    ['b', 'processed'],
  ] as const);

  it('finds new orders and changed statuses, in list order', () => {
    expect(
      changedOrderIds(previous, [
        { id: 'c', status: 'received' },
        { id: 'a', status: 'cancelled' },
        { id: 'b', status: 'processed' },
      ]),
    ).toEqual(['c', 'a']);
  });

  it('ignores orders that left the list', () => {
    expect(changedOrderIds(previous, [{ id: 'b', status: 'processed' }])).toEqual([]);
  });
});

describe('moveSelection', () => {
  const ids = ['a', 'b', 'c'];

  it.each([
    [undefined, 1, 'a'],
    [undefined, -1, 'c'],
    ['a', 1, 'b'],
    ['b', -1, 'a'],
    ['c', 1, 'c'],
    ['a', -1, 'a'],
    ['gone', 1, 'a'],
  ] as const)('from %s by %i → %s', (selected, step, expected) => {
    expect(moveSelection(ids, selected, step)).toBe(expected);
  });

  it('has nothing to select in an empty list', () => {
    expect(moveSelection([], 'a', 1)).toBeUndefined();
  });
});

describe('formatAmount', () => {
  it('groups thousands the Hungarian way', () => {
    expect(formatAmount(12350).replace(/\s/g, ' ')).toBe('12 350');
  });
});
