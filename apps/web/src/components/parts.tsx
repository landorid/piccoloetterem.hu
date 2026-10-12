import type { PriceAdjustment } from '@piccolo/core';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
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
