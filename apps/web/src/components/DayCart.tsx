import type { PricingConfig, PublicMenu } from '@piccolo/core';
import { type RefObject, useMemo } from 'react';
import { dayFull, forint, signedForint } from '../format';
import type { IsoDate } from '../order/cart';
import { priceCartDay, priceLines } from '../order/pricing';
import { useOrder } from '../order/store';
import { strings } from '../strings';
import { adjustmentLabels, cls } from './parts';

const { cart, composer } = strings;

interface DayCartProps {
  date: IsoDate;
  menu: PublicMenu;
  pricing: PricingConfig;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** `cart.edit`: the menu went back into the form. */
  onEdit: () => void;
  /** `cart.remove`: the menu is gone; focus must land somewhere. */
  onRemove: () => void;
  /** `cart.addAnother`: back to the form, as it is. */
  onAddAnother: () => void;
}

/** The day's order: numbered menus as receipts, the day's extras as plain lines, the subtotal. */
export function DayCart({
  date,
  menu,
  pricing,
  headingRef,
  onEdit,
  onRemove,
  onAddAnother,
}: DayCartProps) {
  const menus = useOrder((s) => s.menusByDate[date]);
  const extras = useOrder((s) => s.extrasByDate[date]);
  const editMenu = useOrder((s) => s.editMenu);
  const removeMenu = useOrder((s) => s.removeMenu);
  const priced = useMemo(
    () => (menus ? priceCartDay(date, menus, extras ?? {}, menu, pricing) : null),
    [date, menus, extras, menu, pricing],
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2 ref={headingRef} tabIndex={-1}>
          {cart.title}
        </h2>
        <span className="count">{dayFull(date)}</span>
      </div>
      {!priced ? (
        <div className="cart-empty">
          <p>
            <b>{cart.empty}</b>
          </p>
          <p>{cart.emptyCta}</p>
        </div>
      ) : (
        <>
          {priced.menus.map((pricedMenu, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a menu is identified by its place in the day
            <div key={index} className="cart-menu">
              <div className="cart-who">{cart.menuNumber(index + 1)}</div>
              <div className="cart-lines">
                {priceLines(pricedMenu).map((line) =>
                  line.kind === 'item' ? (
                    <div key={line.item.slot} className="cart-line">
                      <span className="slot">{composer.slots[line.item.slot]}</span>
                      <span className="what">
                        {line.item.variation
                          ? composer.withVariation(line.item.name, line.item.variation)
                          : line.item.name}
                      </span>
                      <span className="amt num">{forint(line.item.unitPrice)}</span>
                    </div>
                  ) : (
                    <div key={line.adjustment.code} className={cls('cart-line', 'adj')}>
                      <span className="slot" />
                      <span className="what">{adjustmentLabels[line.adjustment.code]}</span>
                      <span className="amt num">{signedForint(line.adjustment.amount)}</span>
                    </div>
                  ),
                )}
              </div>
              <div className="cart-menu-total">
                <span>{composer.priceTotal}</span>
                <span className="amt num">{forint(pricedMenu.price)}</span>
              </div>
              <div className="cart-actions">
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() => {
                    editMenu(date, index);
                    onEdit();
                  }}
                >
                  {cart.edit}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    removeMenu(date, index);
                    onRemove();
                  }}
                >
                  {cart.remove}
                </button>
              </div>
            </div>
          ))}
          {priced.extras.length > 0 && (
            <div className="extras">
              {priced.extras.map((extra) => (
                <div key={extra.key} className="extra">
                  <span className="name">{cart.extraLine(extra.name, extra.quantity)}</span>
                  <span className="amt num">{forint(extra.total)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="card-body cart-subtotal">
            <span>{cart.foodSubtotal}</span>
            <span className="num">{forint(priced.foodSubtotal)}</span>
          </div>
          <div className="card-body card-foot">
            <button type="button" className="btn btn-secondary btn-block" onClick={onAddAnother}>
              {cart.addAnother}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
