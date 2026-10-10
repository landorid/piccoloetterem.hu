import {
  adjustmentsOf,
  formatDateHu,
  isoWeekOf,
  parseIsoDate,
  type RestaurantConfig,
  weekLabel,
} from '@piccolo/core';
import { strings } from '../strings';
import { forint } from './format';
import type { Email } from './ses';
import type { StoredExtra, StoredMenu, StoredOrder, StoredSubmission } from './submission';

/** A label and an amount in forints, printed on one line: the label left, the amount right. */
export interface PriceLine {
  label: string;
  amount: number;
}

export interface LinkView {
  text: string;
  href: string;
}

export interface ConfirmationDayView {
  /** `2026. október 13., kedd` */
  date: string;
  /** `Szállítási cím` and the address, or `Személyes átvétel` alone. */
  fulfilment: { label: string; value: string | null };
  menus: { title: string; lines: PriceLine[]; total: PriceLine }[];
  extras: { title: string; lines: PriceLine[] } | null;
  /** Food subtotal, the delivery fee on a delivery day, the day's total. */
  totals: PriceLine[];
}

/**
 * Everything the confirmation e-mail prints, already decided: labels chosen, adjustments derived,
 * extras ordered. Amounts stay numbers; the template formats them and does nothing else.
 */
export interface ConfirmationView {
  /** The inbox snippet. */
  preview: string;
  greeting: string;
  intro: string;
  days: ConfirmationDayView[];
  note: { label: string; text: string } | null;
  grandTotal: PriceLine;
  contact: {
    title: string;
    name: string;
    address: string;
    phone: LinkView;
    email: LinkView;
    openingHours: string;
  };
  replyNote: string;
}

const text = strings.confirmation;

/**
 * The confirmation e-mail of a stored submission, but for its HTML and text: who it goes to, from
 * whom, the subject, and the view the template renders. One e-mail per submission, to the address
 * on its orders; the week in the subject is the first day's (a submission never spans two weeks).
 */
export function confirmationEmail(
  submission: StoredSubmission,
  config: RestaurantConfig,
): Omit<Email, 'html' | 'text'> & { view: ConfirmationView } {
  const [first] = submission.orders;
  if (!first) {
    throw new Error(`Submission ${submission.submissionId} has no orders`);
  }
  const { isoYear, isoWeek } = isoWeekOf(parseIsoDate(first.deliveryDate, config.timezone));
  const grandTotal = submission.orders.reduce((sum, order) => sum + order.total, 0);
  const { contact } = config;

  return {
    from: { name: config.name, address: config.email.from },
    replyTo: config.email.replyTo,
    to: first.email,
    subject: text.subject(weekLabel(isoYear, isoWeek, config)),
    view: {
      preview: text.preview(forint(grandTotal)),
      greeting: text.greeting(first.name),
      intro: text.intro,
      days: submission.orders.map((order) => dayView(order, config)),
      note: first.note === null ? null : { label: text.note, text: first.note },
      grandTotal: { label: text.grandTotal, amount: grandTotal },
      contact: {
        title: text.contactTitle,
        name: config.name,
        address: contact.address,
        phone: { text: contact.phone, href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` },
        email: { text: config.email.replyTo, href: `mailto:${config.email.replyTo}` },
        openingHours: contact.openingHours,
      },
      replyNote: text.replyNote(config.email.replyTo),
    },
  };
}

function dayView(order: StoredOrder, config: RestaurantConfig): ConfirmationDayView {
  const delivery = order.fulfilment === 'delivery';
  const extras = orderedExtras(order.extras, config).map((extra) => ({
    label: text.extra(extra.name, extra.quantity, forint(extra.unitPrice)),
    amount: extra.quantity * extra.unitPrice,
  }));
  return {
    date: formatDateHu(parseIsoDate(order.deliveryDate, config.timezone)),
    fulfilment: delivery
      ? { label: text.deliveryAddress, value: order.address }
      : { label: text.pickup, value: null },
    menus: order.menus.map((menu) => ({
      title: text.menuTitle(menu.position),
      lines: menuLines(menu),
      total: { label: text.menuPrice, amount: menu.price },
    })),
    extras: extras.length === 0 ? null : { title: text.extrasTitle, lines: extras },
    totals: [
      { label: text.foodSubtotal, amount: order.foodSubtotal },
      ...(delivery ? [{ label: text.deliveryFee, amount: order.deliveryFee }] : []),
      { label: text.dayTotal, amount: order.total },
    ],
  };
}

/** One line per item, in slot order, then the soup adjustment the price includes, if any. */
function menuLines(menu: StoredMenu): PriceLine[] {
  const lines = menu.items.map((item) => {
    const slot = text.slots[item.slot];
    return {
      label:
        item.variation === null
          ? text.item(slot, item.name)
          : text.itemWithVariation(slot, item.name, item.variation),
      amount: item.unitPrice,
    };
  });
  const unitPrices = menu.items.map((item) => item.unitPrice);
  for (const adjustment of adjustmentsOf(menu.price, unitPrices)) {
    lines.push({ label: text.adjustments[adjustment.code], amount: adjustment.amount });
  }
  return lines;
}

/** In the config's order, as the order form lists them; a key the config no longer has goes last. */
function orderedExtras(extras: readonly StoredExtra[], config: RestaurantConfig): StoredExtra[] {
  const rank = (extra: StoredExtra) => {
    const index = config.extras.findIndex((def) => def.key === extra.extraKey);
    return index === -1 ? config.extras.length : index;
  };
  return extras.toSorted((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'hu'));
}
