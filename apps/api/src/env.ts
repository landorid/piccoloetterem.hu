import type { RestaurantConfig } from '@piccolo/core';
import type { Db } from '@piccolo/db';

/**
 * The part of a Workers KV namespace the API uses. Declared here instead of using `KVNamespace`,
 * because the frontends typecheck this file without `@cloudflare/workers-types`
 * (`packages/api-client`); `src/menu/cache.test.ts` checks that a real `KVNamespace` fits it.
 */
export interface KvStore {
  get(key: string, type: 'text'): Promise<string | null>;
  /** `expirationTtl` is in seconds, at least 60. */
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Bindings, vars and secrets of the API Worker; see wrangler.toml and README.md. */
export interface Bindings {
  /** Every environment. Under `wrangler dev`, a direct connection to `DATABASE_URL` (scripts/dev.mjs). */
  HYPERDRIVE?: Hyperdrive;
  /**
   * The public menu cache (`src/menu/cache.ts`), and the per-IP order limit under its own
   * `order-rate:` prefix (`src/orders/rateLimit.ts`). Locally, Miniflare's KV.
   */
  MENU_CACHE: KvStore;
  /** Local only, from `.dev.vars`; `HYPERDRIVE` wins when both are set. The tests pass it alone. */
  DATABASE_URL?: string;
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
  RESTAURANT?: string;
  /** Comma-separated browser origins allowed to call the API: the web and admin Workers. */
  CORS_ORIGINS?: string;
  /** Clerk secret key. Staff auth only. From `.dev.vars` locally, `wrangler secret put` when deployed. */
  CLERK_SECRET_KEY?: string;
  /** Clerk publishable key. `authenticateRequest` needs it together with the secret key. */
  CLERK_PUBLISHABLE_KEY?: string;
  /**
   * PEM public key for networkless session JWT verification (`jwtKey`).
   * Dashboard → API keys → Show JWT public key. Without it the Worker would fetch JWKS per request.
   */
  CLERK_JWT_KEY?: string;
  /** Organization whose members are this restaurant's staff. The only role. */
  CLERK_ORG_ID?: string;
  /**
   * Comma-separated admin origins allowed to mint the session token (`azp`).
   * Not a secret. Set in `wrangler.toml`, like `CORS_ORIGINS`.
   */
  CLERK_AUTHORIZED_PARTIES?: string;
  /**
   * `1` logs the confirmation e-mail instead of sending it, and still marks it sent. Set in
   * `wrangler.toml` for local development and the development Worker; unset in production.
   */
  EMAIL_DRY_RUN?: string;
  /** SES region of the sending identity, e.g. `eu-central-1`. Not needed in dry run. */
  SES_REGION?: string;
  /** Access key id of the IAM user allowed to `ses:SendEmail`. A secret. */
  SES_ACCESS_KEY_ID?: string;
  /** That access key's secret. A secret. */
  SES_SECRET_ACCESS_KEY?: string;
}

/** A member of `CLERK_ORG_ID`, set by the `/api/admin/*` middleware. */
export interface Staff {
  userId: string;
  orgId: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    config: RestaurantConfig;
    db: Db;
    /** How many queries `db` has sent so far in this request (the `X-Db-Queries` debug header). */
    dbQueries: () => number;
    staff: Staff;
  };
}
