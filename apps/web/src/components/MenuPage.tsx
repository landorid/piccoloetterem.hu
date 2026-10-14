import type { MenuItem } from '@piccolo/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { dayFull, forint, signedForint, weekRange } from '../format';
import { apiOrigin, createWebApi, type PublicConfig, type PublicMenu, thumbSrc } from '../lib/api';
import {
  dayPrice,
  initialDate,
  type ListedPrice,
  loadMenuPage,
  type MenuPage as Page,
  weekPrice,
} from '../menu/week';
import type { IsoDate } from '../order/cart';
import { type WeekDay, weekDays } from '../order/days';
import { strings } from '../strings';
import { AllergenChips, AllergenTipProvider } from './Allergens';
import { describeLoadError, Message, MessageCard } from './OrderingApp';
import { cls, SoldOut, Tile } from './parts';
import { DayTabs, tabId } from './WeekHeader';

const { menuPage: text } = strings;
const orderHref = '/megrendeles';
const panelId = 'menu-day';
/** The `<main>` of `/`, which the hero's second button scrolls to. */
export const menuSectionId = 'heti-menu';

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

  return (
    <>
      <MenuCard>{main}</MenuCard>
      {load.status === 'loading' && <OrderPill />}
    </>
  );
}

/** The framed card the whole menu sits in, like a printed menu on the table. */
function MenuCard({
  week,
  nav,
  children,
}: {
  week?: { isoWeek: number; days: readonly WeekDay[] };
  nav?: ReactNode;
  children: ReactNode;
}) {
  const first = week?.days[0]?.date;
  const last = week?.days[week.days.length - 1]?.date;
  return (
    <section className="mcard" aria-labelledby="mcard-title">
      <header className="mcard-head">
        <h2 id="mcard-title">{strings.week.heading}</h2>
        {week && first && last && (
          <p className="mcard-meta">
            {text.weekOf(strings.week.number(week.isoWeek), weekRange(first, last))}
          </p>
        )}
      </header>
      {nav}
      <div className="mcard-body">{children}</div>
    </section>
  );
}

/**
 * The order button that floats at the bottom of the screen. It steps aside while the order
 * section's own button is on screen, so the two never show at once.
 */
function OrderPill() {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    const button = document.querySelector('.cta-order');
    if (!button || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setCovered(entry?.isIntersecting ?? false),
    );
    observer.observe(button);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="order-pill" data-hidden={covered}>
      <a className="order-pill-link" href={orderHref}>
        {text.order}
      </a>
    </div>
  );
}

type SectionKey = 'daily' | keyof typeof text.sections | 'prices';
const sectionId = (key: SectionKey) => `menu-${key}`;

/**
 * The card's sticky switcher. On a phone it names the section being read, with arrows to the one
 * before and after; on a wide screen every section is listed. It follows the scroll: the section
 * across the middle of the screen is the current one.
 */
function SectionNav({ sections }: { sections: ReadonlyArray<{ key: SectionKey; title: string }> }) {
  const [current, setCurrent] = useState(sections[0]?.key);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const byId = new Map(sections.map(({ key }) => [sectionId(key), key]));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = byId.get(entry.target.id);
          if (entry.isIntersecting && key) setCurrent(key);
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    for (const id of byId.keys()) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  const index = Math.max(
    0,
    sections.findIndex((section) => section.key === current),
  );
  const jump = (key: SectionKey) => {
    setCurrent(key);
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    document
      .getElementById(sectionId(key))
      ?.scrollIntoView?.({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  };
  const step = (by: number) => {
    const target = sections[(index + by + sections.length) % sections.length];
    if (target) jump(target.key);
  };

  return (
    <nav className="snav" aria-label={text.sectionNav.label}>
      <div className="snav-step">
        <button
          type="button"
          className="snav-arrow"
          aria-label={text.sectionNav.previous}
          onClick={() => step(-1)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="snav-current" aria-live="polite">
          {sections[index]?.title}
        </span>
        <button
          type="button"
          className="snav-arrow"
          aria-label={text.sectionNav.next}
          onClick={() => step(1)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <ul className="snav-list">
        {sections.map(({ key, title }) => (
          <li key={key}>
            <a
              href={`#${sectionId(key)}`}
              aria-current={key === current || undefined}
              onClick={(event) => {
                event.preventDefault();
                jump(key);
              }}
            >
              {title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One part of the menu card, under a heading set between two flourishes. */
function MenuSection({
  sectionKey,
  title,
  children,
}: {
  sectionKey: SectionKey;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={sectionId(sectionKey)} className="msection" aria-label={title}>
      <h3 className="orn">{title}</h3>
      {children}
    </section>
  );
}

type Listed = { key: keyof typeof text.sections; items: readonly MenuItem[]; hint?: string };

/** The week's featured and permanent sections, in menu order, without the empty ones. */
function listedSections(menu: PublicMenu): Listed[] {
  const { permanent } = menu;
  const all: Listed[] = [
    { key: 'featured', items: menu.featured },
    { key: 'allWeek', items: permanent.allWeek },
    { key: 'desserts', items: permanent.desserts },
    { key: 'pickles', items: permanent.pickles },
    { key: 'sides', items: permanent.sides, hint: text.sidesHint },
    { key: 'sideExtras', items: permanent.sideExtras },
  ];
  return all.filter((section) => section.items.length > 0);
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
  const panel = useRef<HTMLDivElement>(null);
  // A guest deep in one day's list who picks another day lands on that day's title, not mid-list.
  const select = (date: IsoDate) => {
    setActive(date);
    const el = panel.current;
    if (!el || el.getBoundingClientRect().top >= 0) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    el.scrollIntoView?.({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  };
  const day = Object.values(menu.days).find((d) => d.date === active) ?? menu.days[1];
  const closed = closedDates.includes(day.date);
  const { soupPrice } = config.pricing;
  const listed = useMemo(() => listedSections(menu), [menu]);
  const sections = useMemo(
    () => [
      { key: 'daily' as const, title: text.daily },
      ...listed.map(({ key }) => ({ key, title: text.sections[key] })),
      { key: 'prices' as const, title: text.prices.title },
    ],
    [listed],
  );

  return (
    <>
      <MenuCard week={{ isoWeek: menu.isoWeek, days }} nav={<SectionNav sections={sections} />}>
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
        <MenuSection sectionKey="daily" title={text.daily}>
          <div className="menu-days">
            <DayTabs days={days} activeDate={day.date} panelId={panelId} onSelect={select} browse />
          </div>
          <div ref={panel} id={panelId} role="tabpanel" aria-labelledby={tabId(day.date)}>
            {/* Keyed by the day, so a newly picked day fades in and the switch is seen. */}
            <div key={day.date} className="menu-day-body">
              <h4 className="menu-day-title">{dayFull(day.date)}</h4>
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
            </div>
          </div>
        </MenuSection>
        {listed.map(({ key, items, hint }) => (
          <MenuSection key={key} sectionKey={key} title={text.sections[key]}>
            <DishList items={items} hint={hint} price={(item) => weekPrice(item, menu)} />
          </MenuSection>
        ))}
        <PriceList config={config} />
      </MenuCard>
      {notice === null && <OrderPill />}
    </>
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
      {title && <h4 className="dish-group-title">{title}</h4>}
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
    price.kind === 'price' && price.saturday !== null && text.saturday(forint(price.saturday)),
  ].filter((note): note is string => typeof note === 'string');
  return (
    <li className={cls('dish', item.soldOut && 'is-soldout')}>
      {thumbSrc(item) !== null && <Tile item={item} fallback={null} className="dish-tile" />}
      <div className="dish-body">
        <p className="dish-line">
          <span className="dish-title">
            {item.name}
            {item.soldOut && <SoldOut />}
            {price.kind !== 'free' && <Leader />}
          </span>
          {price.kind === 'price' && <span className="dish-amt num">{forint(price.amount)}</span>}
          {price.kind === 'soup' && <span className="dish-included">{text.soupIncluded}</span>}
        </p>
        {item.description && <p className="dish-desc">{item.description}</p>}
        {notes.length > 0 && <p className="dish-note">{notes.join(' · ')}</p>}
        <AllergenChips codes={item.allergens} />
      </div>
    </li>
  );
}

/** The dotted line from a dish's name to its price. */
function Leader() {
  return <span className="dish-dots" aria-hidden="true" />;
}

/** The rules a composed menu is priced by, and the extras, all from the config. */
function PriceList({ config }: { config: PublicConfig }) {
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
    <MenuSection sectionKey="prices" title={text.prices.title}>
      <ul className="dishes">
        {rows.map(([name, amount], index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows are fixed for the page's life.
          <li key={index} className="dish">
            <p className="dish-body dish-line">
              <span className="dish-title">
                {name}
                <Leader />
              </span>
              <span className="dish-amt num">{amount}</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="menu-footnote">{text.prices.vat}</p>
    </MenuSection>
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
