import type { RestaurantConfig } from '@piccolo/core';
import type { Db } from '@piccolo/db';

/** Bindings, vars and secrets of the API Worker; see wrangler.toml and README.md. */
export interface Bindings {
  /** Deployed environments only. Local development uses `DATABASE_URL` instead. */
  HYPERDRIVE?: Hyperdrive;
  /** Local development only, from `.dev.vars`. */
  DATABASE_URL?: string;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RESTAURANT?: string;
  /** Comma-separated browser origins allowed to call the API: the web and admin Workers. */
  CORS_ORIGINS?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    config: RestaurantConfig;
    db: Db;
  };
}
