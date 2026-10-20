import type { OrderStatus } from '@piccolo/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { changedOrderIds } from './model';

/** How long a row that changed elsewhere stays highlighted. */
export const freshFor = 10_000;

/**
 * The rows that are new, or whose status changed, since the list last showed them: what a guest or
 * another staff member did since the last poll. Each stays in the set for `freshFor`.
 *
 * `scope` names the list (day, filter, search); the first rows of a scope are its baseline and
 * light up nothing. `expect` records a change this page is about to make itself (an optimistic
 * status), so it does not light up either.
 */
export function useFreshRows(
  scope: string,
  rows: readonly { id: string; status: OrderStatus }[] | undefined,
): { fresh: ReadonlySet<string>; expect: (id: string, status: OrderStatus) => void } {
  const seen = useRef<{ scope: string; statuses: Map<string, OrderStatus> } | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!rows) {
      return;
    }
    const statuses = new Map(rows.map((row) => [row.id, row.status]));
    const previous = seen.current;
    seen.current = { scope, statuses };
    if (previous?.scope !== scope) {
      setFresh(new Set());
      return;
    }
    const changed = changedOrderIds(previous.statuses, rows);
    if (changed.length === 0) {
      return;
    }
    setFresh((current) => new Set([...current, ...changed]));
    for (const id of changed) {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setFresh((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
        }, freshFor),
      );
    }
  }, [scope, rows]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const expect = useCallback((id: string, status: OrderStatus) => {
    seen.current?.statuses.set(id, status);
  }, []);

  return { fresh, expect };
}
