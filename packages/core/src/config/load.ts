import { piccolo } from './piccolo';
import type { RestaurantConfig } from './types';

const instances: Readonly<Record<string, RestaurantConfig>> = { piccolo };

/**
 * Returns the `RestaurantConfig` named by `env.RESTAURANT`. The only way apps obtain a config.
 * Throws when the variable is missing or names no instance, and when the instance is
 * inconsistent (its intake window must end exactly at the cutoff, its statistics parameters must be
 * positive integers and a regular customer needs at least two order days).
 */
export function loadConfig(env: { RESTAURANT?: string }): RestaurantConfig {
  const key = env.RESTAURANT;
  const known = Object.keys(instances).join(', ');
  if (!key) {
    throw new Error(`RESTAURANT is not set. Set it to one of: ${known}.`);
  }
  const config = Object.hasOwn(instances, key) ? instances[key] : undefined;
  if (!config) {
    throw new Error(`Unknown RESTAURANT "${key}". Expected one of: ${known}.`);
  }
  const { until } = config.contact.intakeWindow;
  if (until !== config.cutoff) {
    throw new Error(
      `RestaurantConfig "${key}": contact.intakeWindow.until (${until}) must equal cutoff (${config.cutoff}).`,
    );
  }
  for (const [field, value] of Object.entries(config.statistics)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(
        `RestaurantConfig "${key}": statistics.${field} (${value}) must be a positive integer.`,
      );
    }
  }
  if (config.statistics.regularMinOrderDays < 2) {
    throw new Error(
      `RestaurantConfig "${key}": statistics.regularMinOrderDays must be at least 2, so a regular customer has a gap.`,
    );
  }
  return config;
}
