import {
  type ExtraDef,
  type MenuItem,
  maxExtraQuantity,
  type PricingConfig,
  type PublicMenu,
} from '@piccolo/core';
import { type RefObject, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { forint, signedForint } from '../format';
import type { IsoDate } from '../order/cart';
import { formFor } from '../order/cart';
import { formStatus, isPristine } from '../order/form';
import { type PriceLine, priceForm, priceLines, soupEffect, unitPrice } from '../order/pricing';
import { useOrder } from '../order/store';
import { strings } from '../strings';
import { AllergenChips } from './Allergens';
import { MainPicker } from './MainPicker';
import { adjustmentLabels, cls, SoldOut } from './parts';

const { composer } = strings;

interface ComposerProps {
  date: IsoDate;
  menu: PublicMenu;
  extras: readonly ExtraDef[];
  pricing: PricingConfig;
  /** The number of the menu being built: the day's committed menus plus one. */
  menuNumber: number;
  headingRef: RefObject<HTMLHeadingElement | null>;
  /** Moves focus to the heading once the form re-renders (after adding or emptying it). */
  focusHeading: () => void;
}

/** The on-page form for the day's next menu, in course order, with its live price. */
export function Composer({
  date,
  menu,
  extras,
  pricing,
  menuNumber,
  headingRef,
  focusHeading,
}: ComposerProps) {
  const form = useOrder((s) => formFor(s, date));
  const choose = useOrder((s) => s.choose);
  const resetForm = useOrder((s) => s.resetForm);
  const addMenu = useOrder((s) => s.addMenu);
  const [pickerOpen, setPickerOpen] = useState(false);
  const mainButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const messageId = useId();

  const day = Object.values(menu.days).find((entry) => entry.date === date);
  const soups = day?.soups ?? [];
  const mainItem =
    [...(day?.mains ?? []), ...menu.featured, ...menu.permanent.allWeek].find(
      (item) => item.id === form.mainId,
    ) ?? null;
  const priced = useMemo(() => priceForm(form, menu, date, pricing), [form, menu, date, pricing]);
  const status = formStatus(form, menu, date);
  const pristine = isPristine(form);
  const lines = priceLines(priced.menu);
  const mainLine = priced.menu.items.find((item) => item.slot === 'main');

  const priceOf = (item: MenuItem) => forint(unitPrice(item, date));
  const dishes = (items: readonly MenuItem[]): ChoiceOption[] =>
    items.map((item) => ({ id: item.id, name: item.name, item, amount: priceOf(item) }));
  const none = (amount: string | null): ChoiceOption => ({
    id: null,
    name: composer.none,
    item: null,
    amount,
  });
  const soupAmount = (id: string | null) => {
    const effect = soupEffect(form, id, menu, date, pricing);
    return effect === null ? null : signedForint(effect);
  };
  const soupAnswered = form.soupId !== undefined;
  const variationChosen = form.variation !== null;
  const sideChosen = form.sideId !== null;
  const { pickles, desserts, sides, sideExtras } = menu.permanent;

  return (
    <section className="composer-form" aria-labelledby={headingId}>
      <div className="cf-head">
        <h2 id={headingId} ref={headingRef} tabIndex={-1}>
          {composer.formTitle(menuNumber)}
        </h2>
      </div>
      <div className="cf-body">
        {soups.length > 0 && (
          <ChoiceBlock
            name={`soup-${date}`}
            label={soupAnswered ? composer.slots.soup : composer.answer(composer.slots.soup)}
            required={!soupAnswered}
            hint={mainItem ? null : composer.soupHint}
            tiles={false}
            selected={form.soupId}
            options={[
              ...soups.map((item) => ({
                id: item.id,
                name: item.name,
                item,
                amount: soupAmount(item.id),
              })),
              none(soupAmount(null)),
            ]}
            onSelect={(id) => choose(date, { slot: 'soup', id })}
          />
        )}

        <div>
          <p className="field-label">{composer.slots.main}</p>
          <div className={cls('pickrow choicerow mainrow', mainItem && 'is-picked')}>
            <span className="pbody">
              <span className={mainItem ? 'pname' : 'placeholder'}>
                <button
                  ref={mainButton}
                  type="button"
                  className="stretch"
                  aria-haspopup="dialog"
                  aria-label={mainItem ? composer.mainChosen(mainItem.name) : composer.mainPrompt}
                  onClick={() => setPickerOpen(true)}
                >
                  {mainItem ? mainItem.name : composer.choose}
                </button>
                {mainItem?.soldOut && <SoldOut />}
              </span>
              {mainItem && (
                <span className="pamt num">
                  {mainLine ? forint(mainLine.unitPrice) : priceOf(mainItem)}
                </span>
              )}
              {mainItem && mainItem.allergens.length > 0 && (
                <span className="psub">
                  <AllergenChips codes={mainItem.allergens} />
                </span>
              )}
            </span>
            {mainItem ? (
              <span className="pmark" aria-hidden="true">
                ✓
              </span>
            ) : (
              <span className="chev" aria-hidden="true">
                ›
              </span>
            )}
          </div>
        </div>

        {mainItem && mainItem.variations.length > 0 && (
          <ChoiceBlock
            name={`variation-${date}`}
            label={
              variationChosen ? composer.variationLabel : composer.required(composer.variationLabel)
            }
            required={!variationChosen}
            tiles={false}
            selected={form.variation ?? undefined}
            options={mainItem.variations.map((value) => ({
              id: value,
              name: value,
              item: null,
              amount: priceOf(mainItem),
            }))}
            onSelect={(value) => value && choose(date, { slot: 'variation', value })}
          />
        )}

        {mainItem?.requiresSide && (
          <ChoiceBlock
            name={`side-${date}`}
            label={sideChosen ? composer.slots.side : composer.required(composer.slots.side)}
            required={!sideChosen}
            tiles
            selected={form.sideId ?? undefined}
            options={dishes([...sides, ...sideExtras])}
            onSelect={(id) => id && choose(date, { slot: 'side', id })}
          />
        )}

        {pickles.length > 0 && (
          <ChoiceBlock
            name={`pickle-${date}`}
            label={composer.slots.pickle}
            tiles
            selected={form.pickleId}
            options={[...dishes(pickles), none(forint(0))]}
            onSelect={(id) => choose(date, { slot: 'pickle', id })}
          />
        )}

        {desserts.length > 0 && (
          <ChoiceBlock
            name={`dessert-${date}`}
            label={composer.slots.dessert}
            tiles
            selected={form.dessertId}
            options={[...dishes(desserts), none(forint(0))]}
            onSelect={(id) => choose(date, { slot: 'dessert', id })}
          />
        )}

        <ExtraBlock date={date} extras={extras} quantities={form.extras} />

        {(lines.length > 0 || priced.extrasSubtotal > 0) && (
          <div className="pricebox">
            {lines.map((line) => (
              <PriceRow key={lineKey(line)} line={line} />
            ))}
            <div className="row total">
              <span>{composer.priceTotal}</span>
              <span className="amt num">{forint(priced.menu.price)}</span>
            </div>
            {priced.extrasSubtotal > 0 && (
              <div className="row extras-row">
                <span>{composer.extrasSubtotal}</span>
                <span className="amt num">{forint(priced.extrasSubtotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cf-foot">
        <div className="foot-top">
          <span className="foot-price num" aria-live="polite">
            {forint(priced.total)}
          </span>
        </div>
        {status.message && (
          <p className="error" id={messageId}>
            {status.message}
          </p>
        )}
        <div className="foot-actions">
          {!pristine && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                resetForm(date);
                focusHeading();
              }}
            >
              {composer.reset}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!status.canAdd}
            aria-describedby={status.message ? messageId : undefined}
            onClick={() => {
              addMenu(date, menu);
              focusHeading();
            }}
          >
            {composer.add}
          </button>
        </div>
      </div>

      <MainPicker
        open={pickerOpen}
        date={date}
        menu={menu}
        selectedId={form.mainId}
        onPick={(item) => {
          choose(date, { slot: 'main', item });
          setPickerOpen(false);
        }}
        onClose={() => {
          setPickerOpen(false);
          mainButton.current?.focus();
        }}
      />
    </section>
  );
}

/** The leading square: the item's initial, or an empty dashed square for `composer.none`. */
function Tile({ name }: { name: string | null }) {
  return (
    <span className={cls('tile', name === null && 'tile-none')} aria-hidden="true">
      {name
        ?.replace(/^[0-9. ]+/, '')
        .charAt(0)
        .toLocaleUpperCase('hu-HU')}
    </span>
  );
}

interface ChoiceOption {
  /** `null` is `composer.none`. */
  id: string | null;
  name: string;
  item: MenuItem | null;
  /** What the option costs or changes; `null` shows no amount. */
  amount: string | null;
}

/**
 * One block of inline choices as native radios: one tab stop, arrow keys and the checked state
 * come with them. The label is stretched over the row, so the whole row picks the option, and
 * the allergen chips sit above it as buttons of their own.
 */
function ChoiceBlock({
  name,
  label,
  required = false,
  hint = null,
  tiles,
  selected,
  options,
  onSelect,
}: {
  name: string;
  label: string;
  required?: boolean;
  hint?: string | null;
  tiles: boolean;
  /** `undefined` while nothing is chosen. */
  selected: string | null | undefined;
  options: ChoiceOption[];
  onSelect: (id: string | null) => void;
}) {
  const prefix = useId();
  return (
    <fieldset className="choice-block">
      <legend className={cls('field-label', required && 'is-required')}>{label}</legend>
      {hint && <p className="block-hint">{hint}</p>}
      <div className="choicerows">
        {options.map((option, index) => {
          const id = `${prefix}-${index}`;
          const checked = selected !== undefined && option.id === selected;
          const soldOut = option.item?.soldOut === true;
          return (
            <div
              key={option.id ?? ''}
              className={cls('pickrow choicerow', checked && 'is-picked', soldOut && 'is-disabled')}
            >
              <input
                type="radio"
                className="visually-hidden"
                id={id}
                name={name}
                checked={checked}
                disabled={soldOut}
                aria-describedby={option.amount === null ? undefined : `${id}-amount`}
                onChange={() => onSelect(option.id)}
              />
              {tiles && <Tile name={option.item ? option.name : null} />}
              <span className="pbody">
                <label className="pname stretch" htmlFor={id}>
                  {option.name}
                  {soldOut && <SoldOut />}
                </label>
                {option.amount !== null && (
                  <span className="pamt num" id={`${id}-amount`}>
                    {option.amount}
                  </span>
                )}
                {option.item && option.item.allergens.length > 0 && (
                  <span className="psub">
                    <AllergenChips codes={option.item.allergens} />
                  </span>
                )}
              </span>
              <span className="pmark" aria-hidden="true">
                ✓
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The extras the day's order gets with this menu. Quantities move with − and + only; the number
 * is text. At 0 only a round + shows, so focus has to be carried across the swap both ways.
 */
function ExtraBlock({
  date,
  extras,
  quantities,
}: {
  date: IsoDate;
  extras: readonly ExtraDef[];
  quantities: Record<string, number>;
}) {
  return (
    <fieldset className="choice-block">
      <legend className="field-label">{composer.mealExtras}</legend>
      <div className="choicerows">
        {extras.map((extra) => (
          <ExtraRow
            key={extra.key}
            date={date}
            extra={extra}
            quantity={quantities[extra.key] ?? 0}
          />
        ))}
      </div>
      <p className="extra-note">{composer.mealExtrasHint}</p>
    </fieldset>
  );
}

function ExtraRow({ date, extra, quantity }: { date: IsoDate; extra: ExtraDef; quantity: number }) {
  const stepExtra = useOrder((s) => s.stepExtra);
  const add = useRef<HTMLButtonElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (quantity === 0 ? add : more).current?.focus();
  }, [quantity]);

  const step = (delta: 1 | -1) => {
    refocus.current = (quantity === 0 && delta === 1) || (quantity === 1 && delta === -1);
    stepExtra(date, extra.key, delta);
  };

  return (
    <div className="pickrow choicerow">
      <Tile name={extra.name} />
      <span className="pbody">
        <span className="pname">{extra.name}</span>
        <span className="pamt num">{strings.extras.unitPrice(forint(extra.price))}</span>
      </span>
      {quantity === 0 ? (
        <button
          ref={add}
          type="button"
          className="stepper-add"
          aria-label={strings.extras.moreOf(extra.name)}
          onClick={() => step(1)}
        >
          +
        </button>
      ) : (
        <span className="stepper">
          <button
            type="button"
            aria-label={strings.extras.lessOf(extra.name)}
            onClick={() => step(-1)}
          >
            −
          </button>
          <span className="qty num" aria-live="polite">
            {quantity}
          </span>
          <button
            ref={more}
            type="button"
            aria-label={strings.extras.moreOf(extra.name)}
            disabled={quantity >= maxExtraQuantity}
            onClick={() => step(1)}
          >
            +
          </button>
        </span>
      )}
    </div>
  );
}

function lineKey(line: PriceLine): string {
  return line.kind === 'item' ? line.item.slot : line.adjustment.code;
}

/** A line of the price box; the soup surcharge carries its reason under it. */
function PriceRow({ line }: { line: PriceLine }) {
  if (line.kind === 'item') {
    const { item } = line;
    return (
      <div className="row">
        <span>
          {item.variation ? composer.withVariation(item.name, item.variation) : item.name}
        </span>
        <span className="amt num">{forint(item.unitPrice)}</span>
      </div>
    );
  }
  const { adjustment } = line;
  return (
    <>
      <div className="row adj">
        <span>{adjustmentLabels[adjustment.code]}</span>
        <span className="amt num">{signedForint(adjustment.amount)}</span>
      </div>
      {adjustment.code === 'soup_charge' && <div className="why">{composer.soupSurchargeWhy}</div>}
    </>
  );
}
