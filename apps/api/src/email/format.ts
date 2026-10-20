import { strings } from '../strings';

const number = new Intl.NumberFormat('hu-HU');

/**
 * `650 Ft`, `10 400 Ft`, `−100 Ft`. Hungarian groups thousands only from five digits, with a
 * no-break space (U+00A0, or U+202F in some ICU versions): `Intl`'s, as on the public site. A
 * negative amount gets a real minus sign (U+2212), as the public site's mockup prints a discount;
 * `Intl` would write a hyphen.
 */
export function forint(amount: number): string {
  const digits = strings.forint(number.format(Math.abs(amount)));
  return amount < 0 ? `−${digits}` : digits;
}
