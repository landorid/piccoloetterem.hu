import { Check, ChefHat, Mail, Truck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { dayFull, forint, telHref } from '../format';
import type { PublicConfig } from '../lib/api';
import { strings } from '../strings';
import type { Receipt } from './Checkout';
import { menuDishes } from './OrderRecap';

const { success, cart, summary } = strings;

/**
 * After a stored submission: what happens next, then one receipt with a block per delivery day and
 * the grand total. The totals are the API's; the lines are the cart as sent.
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
  const steps = [
    { icon: Mail, title: success.steps.mail.title, body: success.steps.mail.body(email) },
    { icon: ChefHat, title: success.steps.cook.title, body: success.steps.cook.body },
    { icon: Truck, title: success.steps.deliver.title, body: success.steps.deliver.body },
  ];

  return (
    <div className="screen single">
      <div className="col-main success">
        <header className="success-hero">
          <div className="success-mark" aria-hidden="true">
            <Check size={36} strokeWidth={3} />
            <ChefHat className="success-hat" size={48} strokeWidth={1.5} />
          </div>
          <p className="success-kicker">{success.kicker}</p>
          <h1 ref={heading} tabIndex={-1}>
            {success.title}
          </h1>
          <p className="lead">{success.lead}</p>
        </header>

        <ol className="success-steps" aria-label={success.stepsLabel}>
          {steps.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="success-step-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h2>{title}</h2>
              <p>{body}</p>
            </li>
          ))}
        </ol>

        <section className="card receipt" aria-label={success.daysTitle}>
          <div className="card-head">
            <h2>{success.daysTitle}</h2>
          </div>
          <div className="card-body">
            {days.map(({ date, priced }) => {
              const order = response.orders.find((stored) => stored.deliveryDate === date);
              return (
                <section key={date} className="receipt-day" aria-label={dayFull(date)}>
                  <div className="receipt-day-head">
                    <h3>{dayFull(date)}</h3>
                    <span className="num">{forint(order?.total ?? priced.total)}</span>
                  </div>
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
                </section>
              );
            })}
          </div>
          <div className="receipt-total">
            <span>{summary.grandTotal}</span>
            <span className="receipt-grand num">{forint(response.grandTotal)}</span>
          </div>
        </section>

        <div className="success-actions">
          <button type="button" className="btn btn-secondary" onClick={onNewOrder}>
            {success.newOrder}
          </button>
          <p className="questions">
            {success.questions} <a href={telHref(config.contact.phone)}>{config.contact.phone}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
