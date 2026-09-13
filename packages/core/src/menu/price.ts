import type { TZDate } from '@date-fns/tz';
import { isWeekendPrice } from '../calendar';
import type { MenuItem } from './types';

/**
 * The unit price of an item delivered on `deliveryDate`: the weekend price on Saturday and Sunday
 * (falling back to the weekday price when the item has none), the weekday price otherwise.
 */
export function priceFor(
  item: Pick<MenuItem, 'priceWeekday' | 'priceWeekend'>,
  deliveryDate: TZDate,
): number {
  return isWeekendPrice(deliveryDate)
    ? (item.priceWeekend ?? item.priceWeekday)
    : item.priceWeekday;
}
