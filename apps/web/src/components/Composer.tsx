import {
  type ExtraDef,
  type MenuItem,
  maxExtraQuantity,
  type PricingConfig,
  type PublicMenu,
} from '@piccolo/core';
import { Check, ChevronRight, Minus, Pencil, Plus, UtensilsCrossed } from 'lucide-react';
import { type RefObject, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { forint, signedForint } from '../format';
import type { IsoDate } from '../order/cart';
import { formFor } from '../order/cart';
import { formStatus, formSteps, isPristine } from '../order/form';
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
  /** The day whose add button was clicked while the form could not be added. */
  const [triedOn, setTriedOn] = useState<IsoDate | null>(null);
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
  const { soupAnswered, mainAnswered } = formSteps(form, menu, date);
  const pristine = isPristine(form);
  const message = triedOn === date ? status.message : null;
  const lines = priceLines(priced.menu);
  const mainLine = priced.menu.items.find((item) => item.slot === 'main');

  const priceOf = (item: MenuItem) => forint(unitPrice(item, date));
  /** A dish that costs nothing extra shows no amount: `0 Ft` under every side says nothing. */
  const dishes = (items: readonly MenuItem[]): ChoiceOption[] =>
    items.map((item) => ({
      id: item.id,
      name: item.name,
      item,
      amount: unitPrice(item, date) === 0 ? null : priceOf(item),
    }));
  const none = (amount: string | null): ChoiceOption => ({
    id: null,
    name: composer.none,
    item: null,
    amount,
  });
  const soupAmount = (id: string | null) => {
    const effect = soupEffect(form, id, menu, date, pricing);
    return effect === null || effect === 0 ? null : signedForint(effect);
  };
  const mainName = mainItem
    ? form.variation
      ? composer.withVariation(mainItem.name, form.variation)
      : mainItem.name
    : form.mainId === null
      ? composer.none
      : null;
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
            label={composer.slots.soup}
            hint={mainItem ? null : composer.soupHint}
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

        <Step locked={!soupAnswered}>
          <div>
            <p className="course-label">{composer.slots.main}</p>
            <div className={cls('pickrow mainrow', mainName && 'is-picked')}>
              <span className="tile tile-prompt" aria-hidden="true">
                <UtensilsCrossed size={22} />
              </span>
              <span className="pbody">
                <span className="pname">
                  <button
                    ref={mainButton}
                    type="button"
                    className="stretch"
                    aria-haspopup="dialog"
                    aria-label={mainName ? composer.mainChosen(mainName) : composer.mainPrompt}
                    onClick={() => setPickerOpen(true)}
                  >
                    {mainName ?? composer.mainPlaceholder}
                  </button>
                  {mainItem?.soldOut && <SoldOut />}
                </span>
                {!mainName && <span className="psub">{composer.mainPlaceholderHint}</span>}
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
              {mainName ? (
                <span className="main-cta main-cta-change" aria-hidden="true">
                  <Pencil size={14} strokeWidth={2.25} />
                  <span className="main-cta-label">{composer.mainChange}</span>
                </span>
              ) : (
                <span className="main-cta" aria-hidden="true">
                  {composer.mainPick}
                  <ChevronRight size={16} strokeWidth={2.5} />
                </span>
              )}
            </div>
          </div>
        </Step>

        <Step locked={!soupAnswered || !mainAnswered}>
          {mainItem?.requiresSide && (
            <ChoiceBlock
              name={`side-${date}`}
              label={composer.slots.side}
              selected={form.sideId ?? undefined}
              options={dishes([...sides, ...sideExtras])}
              onSelect={(id) => id && choose(date, { slot: 'side', id })}
            />
          )}

          {pickles.length > 0 && (
            <ChoiceBlock
              name={`pickle-${date}`}
              label={composer.slots.pickle}
              selected={form.pickleId}
              options={[...dishes(pickles), none(null)]}
              onSelect={(id) => choose(date, { slot: 'pickle', id })}
            />
          )}

          {desserts.length > 0 && (
            <ChoiceBlock
              name={`dessert-${date}`}
              label={composer.slots.dessert}
              selected={form.dessertId}
              options={[...dishes(desserts), none(null)]}
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
        </Step>
      </div>

      <div className="cf-foot">
        <div className="foot-top">
          <span className="foot-price num" aria-live="polite">
            {forint(priced.total)}
          </span>
        </div>
        {message && (
          <p className="error" id={messageId} role="alert">
            {message}
          </p>
        )}
        <div className="foot-actions">
          {!pristine && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                resetForm(date);
                setTriedOn(null);
                focusHeading();
              }}
            >
              {composer.reset}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            aria-describedby={message ? messageId : undefined}
            onClick={() => {
              if (!status.canAdd) {
                setTriedOn(date);
                return;
              }
              setTriedOn(null);
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
        selectedVariation={form.variation}
        onPick={(item, variation) => {
          choose(date, { slot: 'main', item, variation });
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

/**
 * One step of the form. Until the steps before it are answered it is blurred and `inert`: out of
 * the tab order, the accessibility tree and the pointer's reach.
 */
function Step({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  return (
    <div className={cls('cf-step', locked && 'is-locked')} inert={locked}>
      {children}
    </div>
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
 * the allergen chips sit above it as buttons of their own. A course's options are one grouped
 * list, joined rows in a single card.
 */
function ChoiceBlock({
  name,
  label,
  hint = null,
  selected,
  options,
  onSelect,
}: {
  name: string;
  label: string;
  hint?: string | null;
  /** `undefined` while nothing is chosen. */
  selected: string | null | undefined;
  options: ChoiceOption[];
  onSelect: (id: string | null) => void;
}) {
  const prefix = useId();
  return (
    <fieldset className="choice-block">
      <legend className="course-label">{label}</legend>
      {hint && <p className="block-hint">{hint}</p>}
      <div className="choicerows">
        {options.map((option, index) => {
          const id = `${prefix}-${index}`;
          const checked = selected !== undefined && option.id === selected;
          const soldOut = option.item?.soldOut === true;
          return (
            <div
              key={option.id ?? ''}
              className={cls(
                'pickrow choicerow',
                checked && 'is-picked',
                soldOut && 'is-disabled',
                option.id === null && 'is-none',
              )}
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
              <span className="pbody">
                <label className="pname stretch" htmlFor={id}>
                  {option.name}
                  {soldOut && <SoldOut />}
                </label>
                {(option.amount !== null || (option.item?.allergens.length ?? 0) > 0) && (
                  <span className="pmeta">
                    {option.amount !== null && (
                      <span className="pamt num" id={`${id}-amount`}>
                        {option.amount}
                      </span>
                    )}
                    {option.item && option.item.allergens.length > 0 && (
                      <AllergenChips codes={option.item.allergens} />
                    )}
                  </span>
                )}
              </span>
              <span className="pmark" aria-hidden="true">
                <Check size={15} strokeWidth={3} />
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
      <legend className="course-label">{composer.mealExtras}</legend>
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

  const atMax = quantity >= maxExtraQuantity;
  const step = (delta: 1 | -1) => {
    if (delta === 1 && atMax) return;
    refocus.current = (quantity === 0 && delta === 1) || (quantity === 1 && delta === -1);
    stepExtra(date, extra.key, delta);
  };

  return (
    <div className="pickrow choicerow">
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
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : (
        <span className="stepper">
          <button
            type="button"
            aria-label={strings.extras.lessOf(extra.name)}
            onClick={() => step(-1)}
          >
            <Minus size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <span className="qty num" aria-live="polite">
            {quantity}
          </span>
          <button
            ref={more}
            type="button"
            aria-label={strings.extras.moreOf(extra.name)}
            // Not `disabled`: the + the guest just pressed keeps focus at the maximum.
            aria-disabled={atMax || undefined}
            onClick={() => step(1)}
          >
            <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
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
