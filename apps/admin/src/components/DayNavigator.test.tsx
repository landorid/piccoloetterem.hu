import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DayNavigator } from '@/components/DayNavigator';
import { useDateParam } from '@/hooks/use-date-param';
import { strings } from '@/strings';

function Harness({ fallback }: { fallback: string | undefined }) {
  const [date, setDate] = useDateParam(fallback);
  const location = useLocation();
  return (
    <>
      {date && <DayNavigator value={date} onChange={setDate} />}
      <output>{location.search}</output>
    </>
  );
}

function renderAt(search: string, fallback: string | undefined) {
  return render(
    <MemoryRouter initialEntries={[`/osszesito${search}`]}>
      <Harness fallback={fallback} />
    </MemoryRouter>,
  );
}

describe('DayNavigator with useDateParam', () => {
  it('writes the fallback into the URL and steps a day back and forward, across a month', () => {
    renderAt('?status=received', '2026-10-31');
    expect(screen.getByRole('status').textContent).toBe('?status=received&date=2026-10-31');

    fireEvent.click(screen.getByRole('button', { name: strings.dayNavigator.next }));
    expect(screen.getByRole('status').textContent).toBe('?status=received&date=2026-11-01');

    fireEvent.click(screen.getByRole('button', { name: strings.dayNavigator.previous }));
    fireEvent.click(screen.getByRole('button', { name: strings.dayNavigator.previous }));
    expect(screen.getByRole('status').textContent).toBe('?status=received&date=2026-10-30');
  });

  it('keeps a valid date from the URL and replaces an invalid one with the fallback', () => {
    const { unmount } = renderAt('?date=2026-10-14', '2026-10-10');
    expect(screen.getByRole('status').textContent).toBe('?date=2026-10-14');
    unmount();

    renderAt('?date=tomorrow', '2026-10-10');
    expect(screen.getByRole('status').textContent).toBe('?date=2026-10-10');
  });

  it('waits for a fallback that is still loading', () => {
    renderAt('', undefined);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByRole('button', { name: strings.dayNavigator.next })).toBeNull();
  });
});
