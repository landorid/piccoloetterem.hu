import type { PriceAdjustment } from '@piccolo/core';
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
