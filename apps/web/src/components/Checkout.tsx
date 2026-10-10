import { type PricingConfig, type PublicMenu, validateContact } from '@piccolo/core';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { dayFull, forint, timeOfDay } from '../format';
import { type PublicConfig, type SubmittedOrder, submitOrder, type WebApi } from '../lib/api';
import {
  browserStorage,
  buildSubmission,
  type Contact,
  type ContactErrors,
  type ContactField,
  contactFields,
  contactMessage,
  emptyContact,
  forgetCustomer,
  needsAddress,
  readCustomer,
  readRejection,
  rememberCustomer,
  type UnavailableItem,
} from '../order/checkout';
import { cartDays, type PricedCart, priceCart } from '../order/pricing';
import { useOrder } from '../order/store';
import { strings } from '../strings';
import { itemName, OrderRecap } from './OrderRecap';
import { cls } from './parts';
import { Totals } from './Summary';

const { checkout, errors: copy } = strings;

/** A stored submission and what it was, for the success screen. */
export interface Receipt {
  response: SubmittedOrder;
  email: string;
  days: PricedCart['days'];
}

interface CheckoutProps {
  api: WebApi;
  menu: PublicMenu;
  config: PublicConfig;
  pricing: PricingConfig;
  onBack: () => void;
  /** The API stored the order. The cart is still full; the caller empties it. */
  onSubmitted: (receipt: Receipt) => void;
  /** The API refused days or dishes the menu offered: it has changed and needs refetching. */
  onMenuStale: () => void;
  /** `errors.soldOutAction` after a sold-out answer: show these dishes in the cart. */
  onShowItems: (items: UnavailableItem[]) => void;
}

/** What the last failed submission left on screen, above the fields. */
type Notice =
  | { kind: 'failed' }
  | { kind: 'rate_limited' }
  | { kind: 'rejected' }
  | {
      kind: 'changed';
      cutoff: string[];
      closed: string[];
      items: UnavailableItem[];
      /** One line per dish: day, menu number and name, read when the API answered. */
      itemLines: string[];
    };

/**
 * Checkout: the contact fields beside the whole order. Validates with core on blur and on
 * submit, sends `POST /api/orders` once at a time, and turns the API's refusals into marked
 * fields, removed days or a list of dishes to replace.
 */
export function Checkout({
  api,
  menu,
  config,
  pricing,
  onBack,
  onSubmitted,
  onMenuStale,
  onShowItems,
}: CheckoutProps) {
  const menusByDate = useOrder((s) => s.menusByDate);
  const extrasByDate = useOrder((s) => s.extrasByDate);
  const removeDays = useOrder((s) => s.removeDays);
  const days = useMemo(
    () => cartDays({ menusByDate, extrasByDate }, pricing),
    [menusByDate, extrasByDate, pricing],
  );
  const priced = useMemo(
    () => priceCart({ menusByDate, extrasByDate }, menu, pricing),
    [menusByDate, extrasByDate, menu, pricing],
  );
  const delivery = needsAddress(days);

  const [remembered, setRemembered] = useState(() => readCustomer(browserStorage()));
  const [contact, setContact] = useState<Contact>(() => ({ ...emptyContact, ...remembered }));
  const [fieldErrors, setFieldErrors] = useState<ContactErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const website = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const inputs = useRef<Partial<Record<ContactField, HTMLInputElement | HTMLTextAreaElement>>>({});

  useEffect(() => {
    window.scrollTo?.(0, 0);
    heading.current?.focus();
  }, []);

  const asked = contactFields.filter((field) => field !== 'address' || delivery);
  const shownErrors = asked.filter((field) => fieldErrors[field]);

  const check = (next: Contact, field: ContactField) => {
    const code = (validateContact(next, delivery) as ContactErrors)[field];
    setFieldErrors((current) => ({ ...current, [field]: code }));
  };

  const change = (field: ContactField, value: string) => {
    const next = { ...contact, [field]: value };
    setContact(next);
    // A marked field is checked as it is corrected, so its error leaves as soon as it is right.
    if (fieldErrors[field]) check(next, field);
  };

  const focusFirst = (found: ContactErrors) => {
    const first = asked.find((field) => found[field]);
    if (first) inputs.current[first]?.focus();
  };

  const forget = () => {
    forgetCustomer(browserStorage());
    setRemembered(null);
    setContact(emptyContact);
    setFieldErrors({});
    setShowSummary(false);
    inputs.current.name?.focus();
  };

  const submit = async (event?: { preventDefault(): void }) => {
    event?.preventDefault();
    if (inFlight.current || days.length === 0) return;
    const found: ContactErrors = validateContact(contact, delivery);
    setFieldErrors(found);
    if (Object.keys(found).length > 0) {
      setShowSummary(true);
      focusFirst(found);
      return;
    }
    setShowSummary(false);
    setNotice(null);
    inFlight.current = true;
    setSubmitting(true);
    const sent = days;
    const sentPriced = priced.days;
    try {
      const response = await submitOrder(
        api,
        buildSubmission(contact, sent, website.current?.value ?? ''),
      );
      rememberCustomer(browserStorage(), contact);
      onSubmitted({ response, email: contact.email.trim(), days: sentPriced });
    } catch (error) {
      const rejection = readRejection(error, sent);
      if (rejection.kind !== 'invalid') {
        setNotice(rejection);
      } else {
        const { contact: marked, cutoff, closed, items, other } = rejection;
        if (Object.keys(marked).length > 0) {
          setFieldErrors(marked);
          setShowSummary(true);
          focusFirst(marked);
        }
        if (cutoff.length > 0 || closed.length > 0) removeDays([...cutoff, ...closed]);
        if (cutoff.length + closed.length + items.length > 0) {
          onMenuStale();
          setNotice({
            kind: 'changed',
            cutoff,
            closed,
            items,
            itemLines: items.map((item) => unavailableLine(item, sentPriced)),
          });
        } else if (other || Object.keys(marked).length === 0) {
          setNotice({ kind: 'rejected' });
        }
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  // A notice is announced by its role; focus follows it only when no field took it.
  useEffect(() => {
    if (notice && !document.activeElement?.closest('.field')) noticeRef.current?.focus();
  }, [notice]);

  const phone = config.contact.phone;
  const below = priced.days.filter((day) => day.priced.missingToMinimum > 0);
  const empty = days.length === 0;

  return (
    <div className="screen screen-checkout">
      <form className="col-main" noValidate onSubmit={submit} aria-busy={submitting}>
        <button type="button" className="btn-quiet back" onClick={onBack}>
          <span aria-hidden="true">‹ </span>
          {checkout.back}
        </button>
        <h1 className="checkout-title" ref={heading} tabIndex={-1}>
          {checkout.title}
        </h1>
        <div className="banners" ref={noticeRef} tabIndex={-1}>
          {notice && (
            <NoticeBanner
              notice={notice}
              phone={phone}
              cutoff={timeOfDay(config.contact.intakeWindow.until)}
              onRetry={() => submit()}
              onShowItems={onShowItems}
            />
          )}
          {empty && (
            <Banner kind="warn" title={strings.summary.empty}>
              <p>{copy.cartEmptied}</p>
            </Banner>
          )}
          {below.length > 0 && (
            // Below the minimum nothing is blocked (#57): checkout is the one place that says
            // so, naming each day and the difference paid on delivery.
            <Banner kind="warn" title={checkout.minimumTitle}>
              <p>{checkout.minimumBody(forint(config.pricing.minimumOrder))}</p>
              <ul>
                {below.map((day) => (
                  <li key={day.date}>
                    {checkout.minimumDay(dayFull(day.date), forint(day.priced.missingToMinimum))}
                  </li>
                ))}
              </ul>
            </Banner>
          )}
          {showSummary && shownErrors.length > 0 && (
            <Banner kind="danger" title={checkout.errors.summary} />
          )}
        </div>
        <section className="card" aria-labelledby="checkout-contact">
          <div className="card-head">
            <h2 id="checkout-contact">{checkout.contact}</h2>
          </div>
          <div className="card-body fields">
            {remembered && (
              <p className="remembered">
                {checkout.remembered}{' '}
                <button
                  type="button"
                  className="btn-quiet"
                  aria-label={checkout.forgetLabel}
                  onClick={forget}
                >
                  {checkout.forget}
                </button>
              </p>
            )}
            <Field
              field="name"
              label={checkout.name}
              placeholder={checkout.namePlaceholder}
              autoComplete="name"
              {...bind('name')}
            />
            <Field
              field="phone"
              label={checkout.phone}
              type="tel"
              placeholder={checkout.phonePlaceholder}
              help={checkout.phoneHelp}
              autoComplete="tel"
              {...bind('phone')}
            />
            <Field
              field="email"
              label={checkout.email}
              type="email"
              help={checkout.emailHelp}
              autoComplete="email"
              {...bind('email')}
            />
            {delivery && (
              <Field
                field="address"
                label={checkout.address}
                placeholder={checkout.addressPlaceholder}
                help={checkout.addressHelp}
                autoComplete="street-address"
                {...bind('address')}
              />
            )}
            <Field
              field="note"
              label={checkout.note}
              placeholder={checkout.notePlaceholder}
              optional
              textarea
              {...bind('note')}
            />
          </div>
        </section>
        {/* The honeypot: hidden from people and from the keyboard, filled only by bots. */}
        <div className="visually-hidden" aria-hidden="true">
          <label>
            {checkout.honeypot}
            <input ref={website} type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p className="payment">{checkout.payment}</p>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || empty}>
          {submitting && <span className="spinner" aria-hidden="true" />}
          {submitting ? checkout.submitting : checkout.submit}
        </button>
      </form>
      <div className="rail">
        <div className="cartsum">
          <p className="eyebrow">{checkout.cartValue}</p>
          <p className="cartsum-total num">{forint(priced.total)}</p>
          <OrderRecap days={priced.days} />
          {!empty && (
            <div className="cartsum-totals">
              <Totals priced={priced} deliveryFee={config.pricing.deliveryFee} live={false} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function bind(field: ContactField) {
    return {
      value: contact[field],
      error: fieldErrors[field] ? contactMessage(field, fieldErrors[field]) : null,
      onChange: (value: string) => change(field, value),
      onBlur: () => check(contact, field),
      inputRef: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
        if (element) inputs.current[field] = element;
        else delete inputs.current[field];
      },
    };
  }
}

/** `errors.soldOutItem`: day, menu number and dish, from the cart as it was submitted. */
function unavailableLine(item: UnavailableItem, days: PricedCart['days']): string {
  const menu = days.find((day) => day.date === item.date)?.priced.menus[item.menu];
  const dish = menu?.items.find((line) => line.slot === item.slot);
  return copy.soldOutItem(
    dayFull(item.date),
    strings.cart.menuNumber(item.menu + 1),
    dish ? itemName(dish) : strings.composer.slots[item.slot],
  );
}

function NoticeBanner({
  notice,
  phone,
  cutoff,
  onRetry,
  onShowItems,
}: {
  notice: Notice;
  phone: string;
  cutoff: string;
  onRetry: () => void;
  onShowItems: (items: UnavailableItem[]) => void;
}) {
  switch (notice.kind) {
    case 'failed':
      return (
        <Banner kind="danger" title={copy.submitFailedTitle}>
          <p>{copy.submitFailedBody(phone)}</p>
          <p className="banner-action">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
              {copy.resubmit}
            </button>
          </p>
        </Banner>
      );
    case 'rate_limited':
      return (
        <Banner kind="danger" title={copy.rateLimitedTitle}>
          <p>{copy.rateLimitedBody(phone)}</p>
        </Banner>
      );
    case 'rejected':
      return (
        <Banner kind="danger" title={copy.rejectedTitle}>
          <p>{copy.rejectedBody(phone)}</p>
        </Banner>
      );
    case 'changed': {
      const names = (dates: string[]) => dates.map(dayFull).join(', ');
      return (
        <>
          {notice.cutoff.length > 0 && (
            <Banner kind="warn" title={copy.cutoffTitle}>
              <p>{copy.cutoffSubmitBody(names(notice.cutoff), cutoff)}</p>
            </Banner>
          )}
          {notice.closed.length > 0 && (
            <Banner kind="warn" title={copy.closedTitle}>
              <p>{copy.closedBody(names(notice.closed))}</p>
            </Banner>
          )}
          {notice.items.length > 0 && (
            <Banner kind="danger" title={copy.soldOutTitle}>
              <p>{copy.soldOutBody}</p>
              <ul>
                {notice.itemLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="banner-action">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onShowItems(notice.items)}
                >
                  {copy.soldOutAction}
                </button>
              </p>
            </Banner>
          )}
        </>
      );
    }
  }
}

export function Banner({
  kind,
  title,
  children,
}: {
  kind: 'warn' | 'danger' | 'ok';
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`banner banner-${kind}`} role={kind === 'danger' ? 'alert' : 'status'}>
      <span className="icon" aria-hidden="true">
        {kind === 'danger' ? '!' : kind === 'ok' ? '✓' : 'i'}
      </span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  field: ContactField;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  type?: 'text' | 'tel' | 'email';
  placeholder?: string;
  help?: string;
  autoComplete?: string;
  optional?: boolean;
  textarea?: boolean;
}

function Field({
  field,
  label,
  value,
  error,
  onChange,
  onBlur,
  inputRef,
  type = 'text',
  placeholder,
  help,
  autoComplete,
  optional = false,
  textarea = false,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [error && errorId, help && helpId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: field,
    className: 'control',
    value,
    placeholder,
    autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-required': optional ? undefined : true,
    'aria-describedby': describedBy,
    onBlur,
  };
  return (
    <div className={cls('field', error && 'has-error')}>
      <label htmlFor={id}>
        {label}
        {!optional && (
          <>
            {' '}
            <span className="req" aria-hidden="true">
              *
            </span>
          </>
        )}
      </label>
      {textarea ? (
        <textarea {...common} ref={inputRef} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input
          {...common}
          ref={inputRef}
          type={type}
          inputMode={type === 'tel' ? 'tel' : type === 'email' ? 'email' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error && (
        <p className="error" id={errorId}>
          {error}
        </p>
      )}
      {help && (
        <p className="help" id={helpId}>
          {help}
        </p>
      )}
    </div>
  );
}
