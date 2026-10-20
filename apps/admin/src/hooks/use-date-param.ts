import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { fromIsoDate } from '@/dates';

/**
 * The day a screen shows, kept in the URL as `?date=YYYY-MM-DD` so a reload or a shared link
 * stays on it. Without a valid one it is `fallback`, written into the URL in place (`replace`),
 * as soon as it is known: pass `undefined` while it loads. Every write keeps the other params.
 */
export function useDateParam(
  fallback: string | undefined,
): [string | undefined, (date: string) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get('date');
  const valid = requested !== null && fromIsoDate(requested) !== undefined;
  const date = valid ? requested : fallback;

  const setDate = useCallback(
    (next: string, options?: { replace: boolean }) =>
      setParams((current) => {
        const updated = new URLSearchParams(current);
        updated.set('date', next);
        return updated;
      }, options),
    [setParams],
  );

  useEffect(() => {
    if (!valid && fallback) {
      setDate(fallback, { replace: true });
    }
  }, [valid, fallback, setDate]);

  return [date, setDate];
}
