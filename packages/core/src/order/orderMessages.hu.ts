import type { OrderErrorCode } from './types';

/** Hungarian text for every order error code. Both frontends render these. */
export const orderMessagesHu: Readonly<Record<OrderErrorCode, string>> = {
  required: 'Kötelező mező.',
  too_short: 'Túl rövid.',
  too_long: 'Túl hosszú.',
  invalid: 'Érvénytelen érték.',
  invalid_phone: 'Ellenőrizd a telefonszámot.',
  invalid_email: 'Érvénytelen e-mail-cím.',
  sold_out: 'Elfogyott.',
  inactive: 'Ez a tétel nem rendelhető.',
  unknown_item: 'Ismeretlen tétel.',
  variation_required: 'Válassz változatot.',
  invalid_variation: 'Ismeretlen változat.',
  side_required: 'Ehhez a főételhez köret jár.',
  not_allowed: 'Ez nem választható.',
  cutoff_passed: 'Erre a napra már nem lehet rendelni.',
  pickup_disabled: 'A személyes átvétel nem elérhető.',
  unknown_extra: 'Ismeretlen extra.',
  invalid_quantity: 'A mennyiség 1 és 20 között lehet.',
  duplicate: 'Ez már szerepel.',
  too_many: 'Legfeljebb 7 nap rendelhető.',
};
