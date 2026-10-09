import type { RestaurantConfig } from '@piccolo/core';

/**
 * The part of `RestaurantConfig` the public site shows: the restaurant's name and contact for the
 * masthead and footer, the prices its copy quotes, the extras it offers, and whether pickup
 * exists. The rest (cutoff, timezone, e-mail sender) stays in the API.
 */
export function publicConfig({ name, contact, pickupEnabled, pricing, extras }: RestaurantConfig) {
  return { name, contact, pickupEnabled, pricing, extras };
}
