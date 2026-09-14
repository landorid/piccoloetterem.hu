import type { RestaurantConfig } from '@piccolo/core';
import type { Db } from '@piccolo/db';

/** Bindings, vars and secrets of the Worker; see wrangler.toml and README.md. */
export interface Bindings {
  /** The built public site and admin SPA (`public/`). */
  ASSETS: Fetcher;
  /** Deployed environments only. Local development uses `DATABASE_URL` instead. */
  HYPERDRIVE?: Hyperdrive;
  /** Local development only, from `.dev.vars`. */
  DATABASE_URL?: string;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RESTAURANT?: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    config: RestaurantConfig;
    db: Db;
  };
}
