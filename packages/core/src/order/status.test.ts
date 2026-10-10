import { describe, expect, it } from 'vitest';
import {
  canChangeStatus,
  type OrderStatus,
  orderStatuses,
  type StatusChange,
  statusChanges,
  statusesBefore,
} from './status';

describe('order status — rule: received → processed, received | processed → cancelled', () => {
  const allowed: [OrderStatus, StatusChange][] = [
    ['received', 'processed'],
    ['received', 'cancelled'],
    ['processed', 'cancelled'],
  ];

  it('allows exactly the three changes', () => {
    const every = orderStatuses.flatMap((from) =>
      statusChanges.map((to): [OrderStatus, StatusChange] => [from, to]),
    );
    expect(every.filter(([from, to]) => canChangeStatus(from, to))).toEqual(allowed);
  });

  it('lists the statuses each change starts from', () => {
    expect(statusesBefore('processed')).toEqual(['received']);
    expect(statusesBefore('cancelled')).toEqual(['received', 'processed']);
  });

  it('never leaves cancelled, and never goes back to received', () => {
    expect(statusChanges.some((to) => canChangeStatus('cancelled', to))).toBe(false);
    expect(statusChanges).not.toContain('received');
  });
});
