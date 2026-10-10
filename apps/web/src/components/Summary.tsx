import type { PricingConfig, PublicMenu } from '@piccolo/core';
import { Fragment, useId, useMemo, useState } from 'react';
import { dayFull, forint } from '../format';
import { type PricedCart, priceCart } from '../order/pricing';
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
}

export function Summary({ variant, menu, pricing, deliveryFee, onContinue }: SummaryProps) {
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
