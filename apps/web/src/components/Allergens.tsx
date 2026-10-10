import { type AllergenCode, allergenCodes, allergenLabelsHu } from '@piccolo/core';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { strings } from '../strings';
import { allergenGlyphs } from './allergenGlyphs';

/** Three chips fit the narrowest row on one line; the rest collapse into one `+N` chip. */
const shownChips = 3;

/** The EU number and the name, as `allergens.tip` writes them; the number is the code's place in the list. */
function allergenTip(code: AllergenCode): string {
  return strings.allergens.tip(allergenCodes.indexOf(code) + 1, allergenLabelsHu[code]);
}

interface Tip {
  show(chip: HTMLElement): void;
  hide(): void;
}

const TipContext = createContext<Tip | null>(null);

export function AllergenChips({ codes }: { codes: readonly AllergenCode[] }) {
  if (codes.length === 0) return null;
  const shown = codes.length > shownChips ? codes.slice(0, shownChips) : codes;
  const rest = codes.slice(shown.length);
  return (
    <span className="achips">
      {shown.map((code) => (
        <Chip key={code} label={allergenTip(code)}>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {allergenGlyphs[code]}
          </svg>
        </Chip>
      ))}
      {rest.length > 0 && (
        <Chip label={strings.allergens.moreLabel(rest.map(allergenTip))}>
          {strings.allergens.more(rest.length)}
        </Chip>
      )}
    </span>
  );
}

/**
 * A real button beside the row's own control, never inside it. Hover, focus and tap name the
 * allergen in the page's one bubble; the label already names it to a screen reader.
 */
function Chip({ label, children }: { label: string; children: ReactNode }) {
  const tip = useContext(TipContext);
  return (
    <button
      type="button"
      className="achip"
      aria-label={label}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') tip?.show(event.currentTarget);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'touch') tip?.hide();
      }}
      onFocus={(event) => tip?.show(event.currentTarget)}
      onBlur={() => tip?.hide()}
      onClick={(event) => tip?.show(event.currentTarget)}
    >
      <span className="adisc">{children}</span>
    </button>
  );
}

/** jsdom has no popovers; there the bubble is a plain fixed element. */
function supportsPopover(el: HTMLElement): boolean {
  return typeof el.showPopover === 'function';
}

/** The sticky chrome a bubble must not cover: the masthead on top, the summary bar below. */
function safeBand(): { top: number; bottom: number } {
  let top = 8;
  let bottom = window.innerHeight - 8;
  const masthead = document.querySelector('.masthead')?.getBoundingClientRect();
  if (masthead && masthead.height > 0 && masthead.top <= 1) top = masthead.bottom + 4;
  const bar = document.querySelector('.sumbar.only-mobile')?.getBoundingClientRect();
  if (bar && bar.height > 0 && bar.top < bottom) bottom = bar.top - 4;
  return { top, bottom };
}

/**
 * The page's one allergen bubble. It is a manual popover so it renders in the top layer, above
 * the main-course dialog, and is placed by measuring its chip: every card around a chip clips
 * its overflow. It follows its chip on scroll and goes once the chip leaves the safe band.
 */
export function AllergenTipProvider({ children }: { children: ReactNode }) {
  const bubble = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLElement | null>(null);

  const hide = useCallback(() => {
    const el = bubble.current;
    anchor.current?.removeAttribute('data-tipopen');
    anchor.current = null;
    if (!el) return;
    el.classList.remove('is-open');
    if (supportsPopover(el) && el.matches(':popover-open')) el.hidePopover();
    el.hidden = true;
  }, []);

  const place = useCallback(() => {
    const el = bubble.current;
    const chip = anchor.current;
    if (!el || !chip) return;
    const band = safeBand();
    const rect = chip.getBoundingClientRect();
    if (rect.bottom < band.top || rect.top > band.bottom || !chip.isConnected) {
      hide();
      return;
    }
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let top = rect.top - height - 1;
    let below = false;
    if (top < band.top) {
      top = rect.bottom + 1;
      below = true;
    }
    if (below && top + height > band.bottom) {
      top = Math.max(band.top, Math.min(rect.top - height - 1, band.bottom - height));
      below = false;
    }
    const centre = rect.left + rect.width / 2;
    const left = Math.max(
      8,
      Math.min(Math.round(centre - width / 2), window.innerWidth - width - 8),
    );
    el.classList.toggle('is-below', below);
    el.style.left = `${left}px`;
    el.style.top = `${Math.round(top)}px`;
    el.style.setProperty(
      '--ax',
      `${Math.max(12, Math.min(width - 12, Math.round(centre - left)))}px`,
    );
  }, [hide]);

  const show = useCallback(
    (chip: HTMLElement) => {
      const el = bubble.current;
      if (!el) return;
      anchor.current?.removeAttribute('data-tipopen');
      anchor.current = chip;
      chip.setAttribute('data-tipopen', '');
      el.textContent = chip.getAttribute('aria-label') ?? '';
      el.hidden = false;
      if (supportsPopover(el)) {
        // Shown again, a popover moves to the top of the top layer, above a dialog opened since.
        if (el.matches(':popover-open')) el.hidePopover();
        el.showPopover();
      }
      place();
      el.classList.add('is-open');
    },
    [place],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('.achip'))) hide();
    };
    const onScroll = () => place();
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [hide, place]);

  const tip = useMemo(() => ({ show, hide }), [show, hide]);
  return (
    <TipContext.Provider value={tip}>
      {children}
      <div
        ref={bubble}
        className="atip"
        role="tooltip"
        aria-hidden="true"
        popover="manual"
        hidden
      />
    </TipContext.Provider>
  );
}
