import { allergenCodes, allergenLabelsHu, parseIsoDate, priceFor } from '@piccolo/core';
import { forint, longDay } from '../format';
import type { PublicMenu, PublicMenuItem } from '../lib/api';
import { strings } from '../strings';

const menuDays = [1, 2, 3, 4, 5, 6] as const;

type MenuScaffoldProps = {
  menu: PublicMenu;
  /** `YYYY-MM-DD`; the days of `menu` a guest can order for now. */
  orderableDates: readonly string[];
};

/**
 * The loaded week, read-only: every day's soups and mains, then the weekly and permanent
 * sections, each dish with its price and allergens. It proves the menu loads; O6 (#34) replaces it
 * with the order form, which keeps the per-dish allergens (EU 1169/2011 Art. 14, docs/PLAN.md §2).
 */
export function MenuScaffold({ menu, orderableDates }: MenuScaffoldProps) {
  const sections = [
    { key: 'featured', title: strings.scaffold.featured, items: menu.featured },
    { key: 'allWeek', title: strings.scaffold.allWeek, items: menu.permanent.allWeek },
    { key: 'sides', title: strings.scaffold.sides, items: menu.permanent.sides },
    { key: 'sideExtras', title: strings.scaffold.sideExtras, items: menu.permanent.sideExtras },
    { key: 'pickles', title: strings.scaffold.pickles, items: menu.permanent.pickles },
    { key: 'desserts', title: strings.scaffold.desserts, items: menu.permanent.desserts },
  ].filter((section) => section.items.length > 0);

  return (
    <section className="week">
      <h1>{strings.week.heading}</h1>
      <p className="week-meta">
        <span className="week-pill">{menu.weekLabel}</span>
      </p>

      {menuDays.map((menuDay) => {
        const day = menu.days[menuDay];
        // Only the calendar date matters for the weekday/weekend price, so any zone will do.
        const date = parseIsoDate(day.date, 'UTC');
        return (
          <section key={day.date} className="card" aria-labelledby={`day-${day.date}`}>
            <h2 id={`day-${day.date}`}>{longDay(day.date)}</h2>
            {!orderableDates.includes(day.date) && (
              <p className="card-note">{strings.scaffold.notOrderable}</p>
            )}
            {day.soups.length > 0 && (
              <>
                <h3>{strings.scaffold.soups}</h3>
                <p className="card-note">{strings.scaffold.soupHint}</p>
                <DishList items={day.soups} price={() => null} />
              </>
            )}
            {day.mains.length > 0 && (
              <>
                <h3>{strings.scaffold.mains}</h3>
                <DishList items={day.mains} price={(item) => forint(priceFor(item, date))} />
              </>
            )}
          </section>
        );
      })}

      {sections.map((section) => (
        <section key={section.key} className="card" aria-labelledby={`section-${section.key}`}>
          <h2 id={`section-${section.key}`}>{section.title}</h2>
          <DishList items={section.items} price={weekPrice} />
        </section>
      ))}
    </section>
  );
}

function DishList({
  items,
  price,
}: {
  items: readonly PublicMenuItem[];
  price: (item: PublicMenuItem) => string | null;
}) {
  return (
    <ul className="dishes">
      {items.map((item) => (
        <Dish key={item.id} item={item} price={price(item)} />
      ))}
    </ul>
  );
}

function Dish({ item, price }: { item: PublicMenuItem; price: string | null }) {
  const allergens = allergenCodes.filter((code) => item.allergens.includes(code));
  return (
    <li className={item.soldOut ? 'dish sold-out' : 'dish'}>
      <p className="dish-head">
        <span className="dish-name">{item.name}</span>
        {price && <span className="dish-price">{price}</span>}
      </p>
      {item.soldOut && <p className="tag">{strings.dish.soldOut}</p>}
      {item.description && <p className="dish-meta">{item.description}</p>}
      {item.variations.length > 0 && (
        <p className="dish-meta">{strings.scaffold.variations(item.variations.join(', '))}</p>
      )}
      {allergens.length > 0 && (
        <p className="dish-meta">
          {strings.scaffold.allergens(
            allergens
              .map((code) =>
                strings.scaffold.allergen(allergenCodes.indexOf(code) + 1, allergenLabelsHu[code]),
              )
              .join(', '),
          )}
        </p>
      )}
    </li>
  );
}

/** A weekly or permanent item: its weekday price, and the weekend one when that differs. */
function weekPrice(item: PublicMenuItem): string {
  const weekday = forint(item.priceWeekday);
  if (item.priceWeekend === null || item.priceWeekend === item.priceWeekday) {
    return weekday;
  }
  return `${weekday} · ${strings.scaffold.weekendPrice(forint(item.priceWeekend))}`;
}
