import type { PricingConfig, PublicMenu } from '@piccolo/core';
import { Fragment, useEffect, useId, useMemo, useState } from 'react';
import { dayFull, forint } from '../format';
import { formFor, type IsoDate } from '../order/cart';
import { formStatus } from '../order/form';
import { type PricedCart, priceCart, priceForm } from '../order/pricing';
import { useOrder } from '../order/store';
import { strings } from '../strings';
import { cls } from './parts';

const { summary } = strings;

interface SummaryProps {
  /** `mobile`: the sticky bar, collapsed until `summary.details`. `desktop`: a card in the rail. */
  variant: 'mobile' | 'desktop';
  menu: PublicMenu;
  pricing: PricingConfig;
  deliveryFee: number;
  /** What `summary.continue` does, supplied by checkout (O7, #35). */
  onContinue?: () => void;
  /** The day whose form the phone's bar can add; `null` on a closed day. */
  activeDate?: IsoDate | null;
  /** The form's foot: while it is in view, its own add button is the one to press. */
  formFoot?: HTMLElement | null;
  /** Called after the phone's bar added the form as a menu. */
  onAdded?: () => void;
}

/**
 * The cart's summary. On a phone it is the sticky bar, and it always offers the next step: while
 * the day's form can be added and its own add button is out of view, the bar adds it; otherwise
 * it leads to checkout, and with an empty cart it is not shown.
 */
export function Summary({
  variant,
  menu,
  pricing,
  deliveryFee,
  onContinue,
  activeDate = null,
  formFoot = null,
  onAdded,
}: SummaryProps) {
  const menusByDate = useOrder((s) => s.menusByDate);
  const extrasByDate = useOrder((s) => s.extrasByDate);
  const priced = useMemo(
    () => priceCart({ menusByDate, extrasByDate }, menu, pricing),
    [menusByDate, extrasByDate, menu, pricing],
  );
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const empty = priced.days.length === 0;
  const open = variant === 'desktop' || expanded;

  const form = useOrder((s) => (activeDate ? formFor(s, activeDate) : null));
  const dayMenus = useOrder((s) => (activeDate ? (s.menusByDate[activeDate]?.length ?? 0) : 0));
  const addMenu = useOrder((s) => s.addMenu);
  const footInView = useInView(variant === 'mobile' ? formFoot : null);
  const addable =
    variant === 'mobile' &&
    activeDate !== null &&
    form !== null &&
    !footInView &&
    formStatus(form, menu, activeDate).canAdd;

  if (variant === 'mobile' && addable && activeDate && form) {
    return (
      <div className="sumbar only-mobile">
        <div className="line">
          <div>
            <div className="what">
              {empty
                ? strings.cart.menuNumber(dayMenus + 1)
                : summary.nextMenu(dayMenus + 1, priced.menuCount)}
            </div>
            <div className="total num">
              {forint(priceForm(form, menu, activeDate, pricing).total)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary add"
            onClick={() => {
              addMenu(activeDate, menu);
              onAdded?.();
            }}
          >
            {summary.addToCart}
          </button>
        </div>
      </div>
    );
  }
  if (variant === 'mobile' && empty) return null;

  return (
    <div className={cls('sumbar', variant === 'desktop' ? 'only-desktop' : 'only-mobile')}>
      {variant === 'desktop' ? (
        <div className="line">
          <h2 className="total">{summary.title}</h2>
        </div>
      ) : (
        <div className="line">
          <div>
            <div className="what">
              {empty ? summary.empty : summary.count(priced.menuCount, priced.days.length)}
            </div>
            <div className="total num" aria-live="polite">
              {forint(priced.total)}
            </div>
          </div>
          <button
            type="button"
            className="toggle"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? summary.hideDetails : summary.details}
          </button>
        </div>
      )}
      {open && (
        <div className="detail" id={detailId}>
          <Totals priced={priced} deliveryFee={deliveryFee} live={variant === 'desktop'} />
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={empty}
        onClick={onContinue}
      >
        {summary.continue}
      </button>
    </div>
  );
}

/** Whether `el` is on screen. Without `IntersectionObserver` (jsdom) it never is. */
function useInView(el: Element | null): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    setInView(false);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? false),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return inView;
}

/**
 * Per day the food and the delivery fee, then what is paid in total. `live` announces the grand
 * total; the mobile bar announces its own, so its expanded detail must not repeat it.
 */
export function Totals({
  priced,
  deliveryFee,
  live,
}: {
  priced: PricedCart;
  deliveryFee: number;
  live: boolean;
}) {
  if (priced.days.length === 0) {
    return (
      <div className="totals">
        <p>
          <b>{summary.empty}</b>
        </p>
        <p className="totals-hint">{summary.emptyHint}</p>
      </div>
    );
  }
  return (
    <div className="totals">
      {priced.days.map((day, index) => (
        <Fragment key={day.date}>
          {index > 0 && <div className="sep" />}
          <div className="day-block">
            <div className="dh">{dayFull(day.date)}</div>
            <div className="row">
              <span className="what">{summary.food}</span>
              <span className="amt num">{forint(day.priced.foodSubtotal)}</span>
            </div>
            <div className="row fee">
              <span className="what">{summary.deliveryFee}</span>
              <span className="amt num">{forint(day.priced.deliveryFee)}</span>
            </div>
          </div>
        </Fragment>
      ))}
      <div className="grand">
        <span>{summary.grandTotal}</span>
        <span className="amt num" aria-live={live ? 'polite' : undefined}>
          {forint(priced.total)}
        </span>
      </div>
      <p className="totals-note">{summary.feeNote(forint(deliveryFee))}</p>
    </div>
  );
}
