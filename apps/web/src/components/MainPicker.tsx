import type { MenuItem, PublicMenu } from '@piccolo/core';
import { Check, X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { dayFull, forint } from '../format';
import type { IsoDate } from '../order/cart';
import { unitPrice } from '../order/pricing';
import { strings } from '../strings';
import { AllergenChips } from './Allergens';
import { cls, SoldOut } from './parts';

interface MainPickerProps {
  open: boolean;
  date: IsoDate;
  menu: PublicMenu;
  /** `undefined` while the main is unanswered; `null` is `composer.none`. */
  selectedId: string | null | undefined;
  selectedVariation: string | null;
  /** `null` is `composer.none`; a dish with variations is picked with one of them. */
  onPick: (item: MenuItem | null, variation?: string) => void;
  onClose: () => void;
}

/**
 * The one sheet left: the day's mains, the featured dishes and the all-week ones, `composer.none`
 * last. A dish with variations is one row per variation, so a single tap picks both. A modal
 * `<dialog>`; its options are buttons, because choosing closes it.
 */
export function MainPicker({
  open,
  date,
  menu,
  selectedId,
  selectedVariation,
  onPick,
  onClose,
}: MainPickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      // jsdom has no showModal.
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  const day = Object.values(menu.days).find((entry) => entry.date === date);
  const groups = [
    { label: strings.sections.mains, items: day?.mains ?? [] },
    { label: strings.sections.featured, items: menu.featured },
    { label: strings.sections.allWeek, items: menu.permanent.allWeek },
  ].filter((group) => group.items.length > 0);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a click on the backdrop does what Escape does
    <dialog
      ref={dialog}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <>
          <div className="sheet-head">
            <div className="titles">
              <h2 id={titleId}>{strings.composer.pickerTitle(strings.composer.slots.main)}</h2>
              <div className="sub">{dayFull(date)}</div>
            </div>
            <button
              type="button"
              className="sheet-close"
              aria-label={strings.common.close}
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="sheet-body">
            <div className="options">
              {groups.map((group) => (
                <PickerGroup key={group.label} label={group.label}>
                  {group.items.flatMap((item) => {
                    const amount = forint(unitPrice(item, date));
                    if (item.variations.length === 0) {
                      return (
                        <PickerOption
                          key={item.id}
                          item={item}
                          name={item.name}
                          amount={amount}
                          picked={item.id === selectedId}
                          onPick={() => onPick(item)}
                        />
                      );
                    }
                    return item.variations.map((variation) => (
                      <PickerOption
                        key={`${item.id}:${variation}`}
                        item={item}
                        name={strings.composer.withVariation(item.name, variation)}
                        amount={amount}
                        picked={item.id === selectedId && variation === selectedVariation}
                        onPick={() => onPick(item, variation)}
                      />
                    ));
                  })}
                </PickerGroup>
              ))}
              <PickerOption
                item={null}
                name={strings.composer.none}
                amount={null}
                picked={selectedId === null}
                onPick={() => onPick(null)}
              />
            </div>
          </div>
        </>
      )}
    </dialog>
  );
}

function PickerGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <h3 className="opt-group">{label}</h3>
      {children}
    </>
  );
}

function PickerOption({
  item,
  name,
  amount,
  picked,
  onPick,
}: {
  item: MenuItem | null;
  name: string;
  amount: string | null;
  picked: boolean;
  onPick: () => void;
}) {
  const amountId = useId();
  const soldOut = item?.soldOut === true;
  return (
    <div className={cls('pickrow option', picked && 'is-picked', soldOut && 'is-disabled')}>
      <span className="pbody">
        <span className="pname">
          <button
            type="button"
            className="stretch"
            aria-pressed={picked}
            disabled={soldOut}
            aria-describedby={amount === null ? undefined : amountId}
            onClick={onPick}
          >
            {name}
          </button>
          {soldOut && <SoldOut />}
        </span>
        {amount !== null && (
          <span className="pamt num" id={amountId}>
            {amount}
          </span>
        )}
        {item && (item.description || item.allergens.length > 0) && (
          <span className="psub">
            {item.description}
            <AllergenChips codes={item.allergens} />
          </span>
        )}
      </span>
      <span className="pmark" aria-hidden="true">
        <Check size={15} strokeWidth={3} />
      </span>
    </div>
  );
}
