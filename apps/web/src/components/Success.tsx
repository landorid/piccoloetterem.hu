import { useEffect, useRef } from 'react';
import { dayFull, forint, telHref } from '../format';
import type { PublicConfig } from '../lib/api';
import { strings } from '../strings';
import type { Receipt } from './Checkout';
import { menuDishes } from './OrderRecap';

const { success, cart, summary } = strings;

/**
 * After a stored submission: one card per delivery day with its own order id, the grand total
 * and the confirmation e-mail's address. The totals are the API's; the lines are the cart as sent.
 */
export function Success({
  receipt,
  config,
  onNewOrder,
}: {
  receipt: Receipt;
  config: PublicConfig;
  onNewOrder: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo?.(0, 0);
    heading.current?.focus();
  }, []);
  const { response, email, days } = receipt;

  return (
    <div className="screen single">
      <div className="col-main success">
        <div className="success-mark" aria-hidden="true">
          ✓
        </div>
        <h1 ref={heading} tabIndex={-1}>
          {success.title}
        </h1>
        <p className="lead">{success.lead(email)}</p>
        <div className="section-h">
          <h2>{success.daysTitle}</h2>
        </div>
        {days.map(({ date, priced }) => {
          const order = response.orders.find((stored) => stored.deliveryDate === date);
          return (
            <section key={date} className="card" aria-label={dayFull(date)}>
              <div className="card-head">
                <h3>{dayFull(date)}</h3>
                <span className="count num">{forint(order?.total ?? priced.total)}</span>
              </div>
              <div className="card-body">
                <div className="cart-lines">
                  {priced.menus.map((menu, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a menu is identified by its place in the day
                    <div key={index} className="cart-line">
                      <span className="slot">{cart.menuNumber(index + 1)}</span>
                      <span className="what">{menuDishes(menu)}</span>
                      <span className="amt num">{forint(menu.price)}</span>
                    </div>
                  ))}
                  {priced.extras.map((extra) => (
                    <div key={extra.key} className="cart-line">
                      <span className="slot">{strings.extras.title}</span>
                      <span className="what">{cart.extraLine(extra.name, extra.quantity)}</span>
                      <span className="amt num">{forint(extra.total)}</span>
                    </div>
                  ))}
                  <div className="cart-line fee">
                    <span className="slot" />
                    <span className="what">{summary.deliveryFee}</span>
                    <span className="amt num">{forint(priced.deliveryFee)}</span>
                  </div>
                </div>
                {order && <p className="order-id">{success.orderId(order.id)}</p>}
              </div>
            </section>
          );
        })}
        <div className="card">
          <div className="card-body">
            <div className="totals">
              <div className="grand">
                <span>{summary.grandTotal}</span>
                <span className="amt num">{forint(response.grandTotal)}</span>
              </div>
            </div>
            <p className="pay-note">{success.payNote}</p>
          </div>
        </div>
        <p className="questions">
          {success.questions} <a href={telHref(config.contact.phone)}>{config.contact.phone}</a>
        </p>
        <button type="button" className="btn btn-secondary" onClick={onNewOrder}>
          {success.newOrder}
        </button>
      </div>
    </div>
  );
}
