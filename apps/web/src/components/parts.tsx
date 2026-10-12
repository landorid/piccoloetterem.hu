import type { MenuItem, PriceAdjustment } from '@piccolo/core';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { thumbSrc } from '../lib/api';
import { strings } from '../strings';

export function cls(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/** The tag after a sold-out dish's name. */
export function SoldOut() {
  return (
    <>
      {' '}
      <span className="tag tag-soldout">{strings.dish.soldOut}</span>
    </>
  );
}

export const adjustmentLabels: Readonly<Record<PriceAdjustment['code'], string>> = {
  no_soup_discount: strings.composer.noSoupDiscount,
  soup_charge: strings.composer.soupSurcharge,
};

const bannerIcons = { warn: Info, danger: CircleAlert, ok: CircleCheck } as const;

/** The leading icon of a `.banner`, by its kind. */
export function BannerIcon({ kind }: { kind: keyof typeof bannerIcons }) {
  const Icon = bannerIcons[kind];
  return <Icon className="icon" size={22} aria-hidden="true" />;
}

/** A dish's initial for its tile, past any leading numbering. */
function initial(name: string): string {
  return name
    .replace(/^[0-9. ]+/, '')
    .charAt(0)
    .toLocaleUpperCase('hu-HU');
}

/**
 * A row's leading square. It shows the dish's photo, else `fallback`; also when the photo fails
 * to load. The failed URL is remembered rather than a flag, so a new version is tried again.
 * Without either it is the empty square of `composer.none`.
 */
export function Tile({
  item,
  fallback = item ? initial(item.name) : null,
  className,
}: {
  item: MenuItem | null;
  fallback?: ReactNode;
  className?: string;
}) {
  const src = item ? thumbSrc(item) : null;
  const [failed, setFailed] = useState<string | null>(null);
  const photo = src !== null && src !== failed;
  return (
    <span
      className={cls('tile', !photo && fallback == null && 'tile-none', className)}
      aria-hidden="true"
    >
      {photo ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} />
      ) : (
        fallback
      )}
    </span>
  );
}
