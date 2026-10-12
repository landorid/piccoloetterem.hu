import type { MenuItem } from '@piccolo/core';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { dayFull, forint, signedForint, telHref, timeOfDay } from '../format';
import { apiOrigin, createWebApi, type PublicConfig, type PublicMenu } from '../lib/api';
import {
  dayPrice,
  initialDate,
  type ListedPrice,
  loadMenuPage,
  type MenuPage as Page,
  weekPrice,
} from '../menu/week';
import type { IsoDate } from '../order/cart';
import { weekDays } from '../order/days';
import { strings } from '../strings';
import { AllergenChips, AllergenTipProvider } from './Allergens';
import { describeLoadError, Message, MessageCard } from './OrderingApp';
import { cls, SoldOut } from './parts';
import { DayTabs, tabId, WeekBar } from './WeekHeader';

const { menuPage: text } = strings;
const orderHref = '/megrendeles';
const panelId = 'menu-day';

export type MenuPageProps = {
  /** Baked into the page when it is built. `config` is null only in a build without the API. */
  initial: { config: PublicConfig | null };
  /** Today's tab and the fallback week; tests fix it. */
  now?: () => Date;
};

/**
 * The island of `/`: the week's menu on day tabs, then the featured and permanent sections, to
 * read. It takes no orders; every way forward links to /megrendeles. The menu is fetched in the
 * browser, as on the order page; the server renders the skeleton and the info card.
 */
export function MenuPage({ initial, now = () => new Date() }: MenuPageProps) {
  const baseUrl = apiOrigin();
  const { config } = initial;
  if (!baseUrl || !config) {
    return (
      <Message
        title={strings.errors.unavailableTitle}
        body={strings.errors.unavailableBody}
        config={null}
      />
    );
  }
  return <LoadedPage baseUrl={baseUrl} config={config} now={now} />;
}

type Load =
  | { status: 'loading' }
  | { status: 'loaded'; page: Page }
  | { status: 'failed'; error: unknown };

function LoadedPage({
  baseUrl,
  config,
  now,
}: {
  baseUrl: string;
  config: PublicConfig;
  now: () => Date;
}) {
  const api = useMemo(() => createWebApi(baseUrl), [baseUrl]);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger, and `now` is read once per load.
  useEffect(() => {
    const controller = new AbortController();
    loadMenuPage(api, now(), { signal: controller.signal }).then(
      (page) => {
        if (!controller.signal.aborted) setLoad({ status: 'loaded', page });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoad({ status: 'failed', error });
      },
    );
    return () => controller.abort();
  }, [api, attempt]);

  if (load.status === 'loaded' && load.page.kind === 'week') {
    return (
      <AllergenTipProvider>
        <Week page={load.page} config={config} now={now} />
      </AllergenTipProvider>
    );
  }

  let main: ReactNode;
  if (load.status === 'loading') {
    main = <MenuSkeleton />;
  } else if (load.status === 'failed') {
    const { title, body } = describeLoadError(load.error);
    main = (
      <MessageCard title={title} body={body} config={config}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        >
          {strings.errors.retry}
        </button>
      </MessageCard>
    );
  } else if (load.page.kind === 'none' && load.page.state === 'next_week_not_published') {
    main = (
      <MessageCard
        title={strings.errors.nextWeekTitle}
        body={strings.errors.nextWeekBody}
        config={config}
      />
    );
  } else {
    main = (
      <MessageCard
        title={strings.errors.emptyWeekTitle}
        body={strings.errors.emptyWeekBody}
        config={config}
      />
    );
  }

  // A message carries its own heading; the week's heading waits for the week.
  return (
    <>
      {load.status === 'loading' && (
        <div className="weekbar">
          <h1>{strings.week.heading}</h1>
        </div>
      )}
      <Layout config={config} ordering={load.status !== 'loaded'}>
        {main}
      </Layout>
    </>
  );
}

/** The main column, the info card beside it, and on a phone the order bar below. */
function Layout({
  config,
  ordering,
  children,
}: {
  config: PublicConfig;
  ordering: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className="screen menu-screen">
        <div className="menu-main">{children}</div>
        <aside className="menu-aside">
          <InfoCard config={config} />
        </aside>
      </div>
      {ordering && (
        <div className="menu-orderbar only-mobile">
          <a className="btn btn-primary btn-block" href={orderHref}>
            {text.order}
          </a>
        </div>
      )}
    </>
  );
}

function Week({
  page,
  config,
  now,
}: {
  page: Extract<Page, { kind: 'week' }>;
  config: PublicConfig;
  now: () => Date;
}) {
  const { menu, orderableDates, closedDates, notice } = page;
  const days = useMemo(
    () => weekDays(menu, orderableDates, closedDates),
    [menu, orderableDates, closedDates],
  );
  const [active, setActive] = useState<IsoDate>(() => initialDate(menu, orderableDates, now()));
  const day = Object.values(menu.days).find((d) => d.date === active) ?? menu.days[1];
  const closed = closedDates.includes(day.date);
  const { soupPrice } = config.pricing;
  const { permanent } = menu;

  return (
    <>
      <WeekBar isoWeek={menu.isoWeek} days={days} cutoff={null} terms={config.pricing} />
      <DayTabs days={days} activeDate={day.date} panelId={panelId} onSelect={setActive} browse />
      <Layout config={config} ordering={notice === null}>
        {notice && (
          <div className="banner banner-warn" role="status">
            <div>
              <p>
                <strong>
                  {notice === 'next_week_not_published'
                    ? text.notices.nextWeekTitle
                    : text.notices.closedTitle}
                </strong>
              </p>
              <p>
                {notice === 'next_week_not_published'
                  ? text.notices.nextWeekBody
                  : text.notices.closedBody}
              </p>
            </div>
          </div>
        )}
        <section
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(day.date)}
          className="card menu-card"
        >
          <div className="card-head">
            <h2>{dayFull(day.date)}</h2>
          </div>
          {closed && <p className="menu-closed">{strings.errors.closedDay}</p>}
          {day.soups.length === 0 && day.mains.length === 0 ? (
            <p className="menu-empty">{text.emptyDay}</p>
          ) : (
            <>
              <DishList
                title={text.soups}
                items={day.soups}
                price={(item) => dayPrice(item, day.date, soupPrice)}
              />
              <DishList
                title={text.mains}
                hint={text.mainsHint}
                items={day.mains}
                price={(item) => dayPrice(item, day.date, soupPrice)}
              />
            </>
          )}
        </section>
        <Section title={text.sections.featured} items={menu.featured} menu={menu} />
        <Section title={text.sections.allWeek} items={permanent.allWeek} menu={menu} />
        <Section title={text.sections.desserts} items={permanent.desserts} menu={menu} />
        <Section title={text.sections.pickles} items={permanent.pickles} menu={menu} />
        <Section
          title={text.sections.sides}
          hint={text.sidesHint}
          items={permanent.sides}
          menu={menu}
        />
        <Section title={text.sections.sideExtras} items={permanent.sideExtras} menu={menu} />
        <PriceCard config={config} />
      </Layout>
    </>
  );
}

/** A featured or permanent section; left out when staff listed nothing in it. */
function Section({
  title,
  hint,
  items,
  menu,
}: {
  title: string;
  hint?: string;
  items: readonly MenuItem[];
  menu: PublicMenu;
}) {
  if (items.length === 0) return null;
  return (
    <section className="card menu-card" aria-label={title}>
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      <DishList items={items} hint={hint} price={(item) => weekPrice(item, menu)} />
    </section>
  );
}

function DishList({
  title,
  hint,
  items,
  price,
}: {
  title?: string;
  hint?: string | undefined;
  items: readonly MenuItem[];
  price: (item: MenuItem) => ListedPrice;
}) {
  if (items.length === 0) return null;
  return (
    <div className="dish-group">
      {title && <h3 className="dish-group-title">{title}</h3>}
      {hint && <p className="dish-group-hint">{hint}</p>}
      <ul className="dishes">
        {items.map((item) => (
          <Dish key={item.id} item={item} price={price(item)} />
        ))}
      </ul>
    </div>
  );
}

function Dish({ item, price }: { item: MenuItem; price: ListedPrice }) {
  const notes = [
    item.variations.length > 0 && text.variations(item.variations),
    item.soupIncluded && item.category !== 'daily_main' && text.withSoup,
    item.requiresSide && text.withSide,
  ].filter((note): note is string => typeof note === 'string');
  return (
    <li className={cls('dish', item.soldOut && 'is-soldout')}>
      <div className="dish-body">
        <p className="dish-name">
          <span className="dish-title">{item.name}</span>
          {item.soldOut && <SoldOut />}
        </p>
        {item.description && <p className="dish-desc">{item.description}</p>}
        {notes.length > 0 && <p className="dish-note">{notes.join(' · ')}</p>}
        <AllergenChips codes={item.allergens} />
      </div>
      <Price price={price} />
    </li>
  );
}

function Price({ price }: { price: ListedPrice }) {
  switch (price.kind) {
    case 'free':
      return null;
    case 'soup':
      return (
        <p className="dish-price">
          <span className="dish-included">{text.soupIncluded}</span>
          <span className="dish-sub num">{text.soupAlone(forint(price.alone))}</span>
        </p>
      );
    case 'price':
      return (
        <p className="dish-price">
          <span className="dish-amt num">{forint(price.amount)}</span>
          {price.saturday !== null && (
            <span className="dish-sub num">{text.saturday(forint(price.saturday))}</span>
          )}
        </p>
      );
  }
}

/** The rules a composed menu is priced by, and the extras, all from the config. */
function PriceCard({ config }: { config: PublicConfig }) {
  const { pricing, extras } = config;
  const rows: Array<[string, string]> = [
    [text.prices.soupAlone, forint(pricing.soupPrice)],
    [text.prices.noSoup, signedForint(-pricing.noSoupDiscount)],
    ...extras.map((extra): [string, string] => [
      extra.name,
      text.prices.perPiece(forint(extra.price)),
    ]),
  ];
  return (
    <section className="card menu-card" aria-label={text.prices.title}>
      <div className="card-head">
        <h2>{text.prices.title}</h2>
      </div>
      <ul className="dishes">
        {rows.map(([name, amount], index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows are fixed for the page's life.
          <li key={index} className="dish">
            <p className="dish-body dish-title">{name}</p>
            <p className="dish-price">
              <span className="dish-amt num">{amount}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="menu-footnote">{text.prices.vat}</p>
    </section>
  );
}

function InfoCard({ config }: { config: PublicConfig }) {
  const { contact, pricing } = config;
  const { info } = text;
  return (
    <section className="card menu-info" aria-label={info.title}>
      <div className="card-head">
        <h2>{info.title}</h2>
      </div>
      <div className="card-body">
        <dl className="info-list">
          <dt>{info.deliveryFee}</dt>
          <dd>
            {info.deliveryFeeValue(forint(pricing.deliveryFee))}
            <br />
            {info.deliveryDays}
          </dd>
          <dt>{info.minimum}</dt>
          <dd>{info.minimumValue(forint(pricing.minimumOrder))}</dd>
          <dt>{info.intake}</dt>
          <dd className="num">
            {info.intakeValue(
              timeOfDay(contact.intakeWindow.from),
              timeOfDay(contact.intakeWindow.until),
            )}
          </dd>
          <dt>{info.phone}</dt>
          <dd>
            <a href={telHref(contact.phone)}>{contact.phone}</a>
          </dd>
          <dt>{info.opening}</dt>
          <dd>{contact.openingHours}</dd>
          <dt>{info.address}</dt>
          <dd>{contact.address}</dd>
        </dl>
        <a className="btn btn-primary btn-block" href={orderHref}>
          {text.order}
        </a>
      </div>
    </section>
  );
}

function MenuSkeleton() {
  return (
    <div className="skeleton" aria-busy="true">
      <p className="visually-hidden" role="status">
        {strings.week.loading}
      </p>
      {[1, 2, 3].map((n) => (
        <div key={n} className="skeleton-card" aria-hidden="true">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-short" />
          <span className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
