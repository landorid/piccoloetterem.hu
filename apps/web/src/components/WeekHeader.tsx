import type { CSSProperties, KeyboardEvent } from 'react';
import { useRef } from 'react';
import { dayFull, dayNumber, forint, weekRange } from '../format';
import type { IsoDate } from '../order/cart';
import type { WeekDay } from '../order/days';
import { useOrder } from '../order/store';
import { strings } from '../strings';

const { days: dayStrings, week } = strings;

interface WeekBarProps {
  isoWeek: number;
  days: readonly WeekDay[];
  /** The cutoff sentence, already chosen; `null` shows none. */
  cutoff: string | null;
  deliveryFee: number;
  minimumOrder: number;
}

export function WeekBar({ isoWeek, days, cutoff, deliveryFee, minimumOrder }: WeekBarProps) {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  return (
    <div className="weekbar">
      <h1>{week.heading}</h1>
      <div className="week-meta">
        <span className="week-pill">{week.number(isoWeek)}</span>
        {first && last && <span>{weekRange(first, last)}</span>}
        {cutoff && <span>{cutoff}</span>}
      </div>
      <p className="week-terms">{strings.order.terms(forint(deliveryFee), forint(minimumOrder))}</p>
    </div>
  );
}

export const tabId = (date: IsoDate) => `day-tab-${date}`;

interface DayRailProps {
  days: readonly WeekDay[];
  activeDate: IsoDate;
  panelId: string;
  onSelect: (date: IsoDate) => void;
}

/**
 * The week strip: six equal columns, never scrolled. Past days are disabled. A day staff closed
 * keeps its place, looks disabled and can still be selected, to say why it cannot be ordered.
 * Arrow keys move focus; Enter, Space or a click selects.
 */
export function DayRail({ days, activeDate, panelId, onSelect }: DayRailProps) {
  const menusByDate = useOrder((s) => s.menusByDate);
  const tabs = useRef(new Map<IsoDate, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const reachable = days.filter((day) => day.state !== 'past').map((day) => day.date);
    const current = reachable.findIndex(
      (date) => tabs.current.get(date) === document.activeElement,
    );
    const target = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: reachable.length - 1,
    }[event.key];
    if (target === undefined || current === -1) return;
    event.preventDefault();
    const date = reachable[(target + reachable.length) % reachable.length];
    if (date) tabs.current.get(date)?.focus();
  };

  return (
    <div className="daybar">
      <div
        className="daylist"
        role="tablist"
        aria-label={week.heading}
        style={{ '--daycols': days.length } as CSSProperties}
        onKeyDown={onKeyDown}
      >
        {days.map((day) => {
          const selected = day.date === activeDate;
          const count = menusByDate[day.date]?.length ?? 0;
          const mark =
            count > 0
              ? dayStrings.badgeTitle(count)
              : day.state === 'closed'
                ? dayStrings.closed
                : null;
          return (
            <button
              key={day.date}
              ref={(el) => {
                if (el) tabs.current.set(day.date, el);
                else tabs.current.delete(day.date);
              }}
              type="button"
              role="tab"
              id={tabId(day.date)}
              className="day"
              aria-selected={selected}
              aria-controls={panelId}
              aria-label={dayStrings.tabLabel(dayFull(day.date), mark)}
              aria-disabled={day.state === 'closed' || undefined}
              disabled={day.state === 'past'}
              title={day.state === 'past' ? dayStrings.pastTitle : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(day.date)}
            >
              <span className="dow">{dayStrings.short[day.index]}</span>
              <span className="dnum num">{dayNumber(day.date)}</span>
              <span className="dmark">
                {count > 0 ? (
                  <span className="dbadge num" title={dayStrings.badgeTitle(count)}>
                    {count}
                  </span>
                ) : (
                  day.state === 'closed' && <span className="dclosed">{dayStrings.closed}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
