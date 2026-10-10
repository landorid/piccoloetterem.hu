import {
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { dayFull, timeOfDay, weekdayName } from '../format';
import type { OpenMenu, PublicConfig } from '../lib/api';
import type { IsoDate } from '../order/cart';
import { cutoffNote, weekDays } from '../order/days';
import { pricingConfig } from '../order/pricing';
import { useOrder } from '../order/store';
import { strings } from '../strings';
import { AllergenTipProvider } from './Allergens';
import { Composer } from './Composer';
import { DayCart } from './DayCart';
import { Summary } from './Summary';
import { DayRail, tabId, WeekBar } from './WeekHeader';

interface OrderScreenProps {
  open: OpenMenu;
  config: PublicConfig;
  now: () => Date;
}

/**
 * Moves focus to an element after the render a state change causes. The target is a ref, read
 * once the new markup is in place: it may be an element the change itself mounts.
 */
function useFocusAfterRender() {
  const target = useRef<RefObject<HTMLElement | null> | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    target.current?.current?.focus();
    target.current = null;
  });
  return useCallback((ref: RefObject<HTMLElement | null>) => {
    target.current = ref;
    rerender();
  }, []);
}

/** The order page of an open week: week bar, day rail, the day's form and order, the summary. */
export function OrderScreen({ open, config, now }: OrderScreenProps) {
  const { menu, orderableDates } = open;
  const days = useMemo(() => weekDays(menu, orderableDates), [menu, orderableDates]);
  const pricing = useMemo(() => pricingConfig(config), [config]);
  const storedDate = useOrder((s) => s.activeDate);
  const selectDate = useOrder((s) => s.selectDate);
  const droppedDates = useOrder((s) => s.droppedDates);
  const dismissDropped = useOrder((s) => s.dismissDropped);
  const panelId = useId();
  const panelHeading = useRef<HTMLHeadingElement>(null);
  const cartHeading = useRef<HTMLHeadingElement>(null);
  const focusAfterRender = useFocusAfterRender();

  const activeDay =
    days.find((day) => day.date === storedDate && day.state !== 'past') ??
    days.find((day) => day.state === 'open');
  const activeDate = activeDay?.date ?? orderableDates[0] ?? '';
  const menuCount = useOrder((s) => s.menusByDate[activeDate]?.length ?? 0);

  const until = config.contact.intakeWindow.until;
  const time = timeOfDay(until);
  const note = cutoffNote(orderableDates, now(), until);
  const cutoff =
    note === 'today'
      ? strings.week.cutoffToday(time)
      : note === 'tomorrow'
        ? strings.week.cutoffPassed(time)
        : null;
  const focusPanel = () => focusAfterRender(panelHeading);

  return (
    <AllergenTipProvider>
      <WeekBar
        isoWeek={menu.isoWeek}
        days={days}
        cutoff={cutoff}
        deliveryFee={config.pricing.deliveryFee}
        minimumOrder={config.pricing.minimumOrder}
      />
      <DayRail
        days={days}
        activeDate={activeDate}
        panelId={panelId}
        onSelect={(date: IsoDate) => {
          selectDate(date);
          focusPanel();
        }}
      />
      <div
        className="screen screen-menu"
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(activeDate)}
      >
        <div className="banners">
          {droppedDates.map((date) => (
            <div key={date} className="banner banner-warn" role="status">
              <span className="icon" aria-hidden="true">
                i
              </span>
              <div>
                <h3>{strings.errors.cutoffTitle}</h3>
                <p>{strings.errors.cutoffBody(weekdayName(date), time)}</p>
                <p className="banner-action">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      dismissDropped(date);
                      focusPanel();
                    }}
                  >
                    {strings.errors.cutoffAction}
                  </button>
                </p>
              </div>
            </div>
          ))}
        </div>
        {activeDay?.state === 'closed' ? (
          <section className="card closed-day">
            <div className="card-head">
              <h2 ref={panelHeading} tabIndex={-1}>
                {dayFull(activeDate)}
              </h2>
            </div>
            <p className="card-body">{strings.errors.closedDay}</p>
          </section>
        ) : (
          <Composer
            key={activeDate}
            date={activeDate}
            menu={menu}
            extras={config.extras}
            pricing={pricing}
            menuNumber={menuCount + 1}
            headingRef={panelHeading}
            focusHeading={focusPanel}
          />
        )}
        <div className="rail">
          {activeDay?.state !== 'closed' && (
            <DayCart
              date={activeDate}
              menu={menu}
              pricing={pricing}
              headingRef={cartHeading}
              onEdit={focusPanel}
              onRemove={() => focusAfterRender(cartHeading)}
              onAddAnother={focusPanel}
            />
          )}
          <Summary
            variant="desktop"
            menu={menu}
            pricing={pricing}
            deliveryFee={config.pricing.deliveryFee}
          />
        </div>
      </div>
      <Summary
        variant="mobile"
        menu={menu}
        pricing={pricing}
        deliveryFee={config.pricing.deliveryFee}
      />
    </AllergenTipProvider>
  );
}
