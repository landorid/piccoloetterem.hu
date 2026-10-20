import type { PricedMenu, PricedMenuItem } from '@piccolo/core';
import { dayFull, forint } from '../format';
import type { PricedCart } from '../order/pricing';
import { strings } from '../strings';

const { cart, composer, summary } = strings;

/** A dish as a receipt names it, with its variation (`composer.withVariation`). */
export function itemName(item: PricedMenuItem): string {
  return item.variation ? composer.withVariation(item.name, item.variation) : item.name;
}

/** The menu's dishes in one line, for the success screen. */
export function menuDishes(menu: PricedMenu): string {
  return menu.items.map(itemName).join(', ');
}

/** Checkout's rail: one card per day with its menus, extras, food and delivery fee. */
export function OrderRecap({ days }: { days: PricedCart['days'] }) {
  return days.map(({ date, priced }) => (
    <section key={date} className="card recap" aria-label={dayFull(date)}>
      <div className="card-head">
        <h3>{dayFull(date)}</h3>
        <span className="count num">{forint(priced.total)}</span>
      </div>
      {priced.menus.map((menu, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a menu is identified by its place in the day
        <div key={index} className="cart-menu">
          <div className="cart-who">{cart.menuNumber(index + 1)}</div>
          <div className="amt num recap-price">{forint(menu.price)}</div>
          <div className="cart-lines">
            {menu.items.map((item) => (
              <div key={item.slot} className="cart-line">
                <span className="slot">{composer.slots[item.slot]}</span>
                <span className="what">{itemName(item)}</span>
              </div>
            ))}
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
      <div className="card-body recap-totals">
        <div className="totals">
          <div className="row">
            <span className="what">{summary.food}</span>
            <span className="amt num">{forint(priced.foodSubtotal)}</span>
          </div>
          <div className="row fee">
            <span className="what">{summary.deliveryFee}</span>
            <span className="amt num">{forint(priced.deliveryFee)}</span>
          </div>
        </div>
      </div>
    </section>
  ));
}
