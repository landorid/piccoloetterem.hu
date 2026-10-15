import type { ReactNode } from 'react';
import { forint, telHref, timeOfDay } from '../format';
import type { PublicConfig } from '../lib/api';
import { strings } from '../strings';

/*
 * The restaurant facts around the menu on `/`. Rendered once at build time from the public config
 * (index.astro renders them without `client:`), so they ship as HTML with no JavaScript.
 */

const { landing: text } = strings;

type Row = { label: string; value: ReactNode };

/** Label, a rule, value: the template's price-list line, used for every fact on the page. */
function Leaders({ rows }: { rows: readonly Row[] }) {
  return (
    <dl className="lp-leaders">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Phone({ phone }: { phone: string }) {
  return <a href={telHref(phone)}>{phone}</a>;
}

export function Hours({ config }: { config: PublicConfig }) {
  const { contact } = config;
  return (
    <section className="lp-section" data-area="hours" aria-labelledby="lp-hours">
      <h2 id="lp-hours">{text.hours.title}</h2>
      <Leaders
        rows={[
          { label: text.hours.restaurant, value: contact.openingHours },
          {
            label: text.hours.intake,
            value: text.hours.intakeValue(
              timeOfDay(contact.intakeWindow.from),
              timeOfDay(contact.intakeWindow.until),
            ),
          },
          { label: text.hours.delivery, value: text.hours.deliveryDays },
        ]}
      />
    </section>
  );
}

export function DeliveryCard({ config, orderHref }: { config: PublicConfig; orderHref: string }) {
  const { pricing, contact } = config;
  return (
    <section className="lp-delivery" data-area="delivery" aria-labelledby="lp-delivery">
      <h2 id="lp-delivery">{text.delivery.title}</h2>
      <Leaders
        rows={[
          { label: text.delivery.fee, value: text.delivery.feeValue(forint(pricing.deliveryFee)) },
          {
            label: text.delivery.minimum,
            value: text.delivery.minimumValue(forint(pricing.minimumOrder)),
          },
        ]}
      />
      <a className="btn btn-primary" href={orderHref}>
        {text.delivery.order}
      </a>
      <p className="lp-delivery-phone">
        {text.delivery.orByPhone} <Phone phone={contact.phone} />
      </p>
    </section>
  );
}

export function Contact({ config }: { config: PublicConfig }) {
  const { contact } = config;
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`;
  return (
    <section
      className="lp-section"
      id="elerhetoseg"
      data-area="contact"
      aria-labelledby="lp-contact"
    >
      <h2 id="lp-contact">{text.contact.title}</h2>
      <Leaders
        rows={[
          { label: text.contact.address, value: contact.address },
          { label: text.contact.phone, value: <Phone phone={contact.phone} /> },
        ]}
      />
      <a className="lp-textlink" href={directions}>
        {text.contact.directions}
      </a>
    </section>
  );
}
