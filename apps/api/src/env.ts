import type { RestaurantConfig } from '@piccolo/core';
import type { Db } from '@piccolo/db';

/**
 * The part of a Workers KV namespace the API uses. Declared here instead of using `KVNamespace`,
 * because the frontends typecheck this file without `@cloudflare/workers-types`
 * (`packages/api-client`); `src/menu/cache.test.ts` checks that a real `KVNamespace` fits it.
 */
export interface KvStore {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** Bindings, vars and secrets of the API Worker; see wrangler.toml and README.md. */
export interface Bindings {
  /** Deployed environments only. Local development uses `DATABASE_URL` instead. */
  HYPERDRIVE?: Hyperdrive;
  /** The public menu cache (`src/menu/cache.ts`). Locally, Miniflare's KV. */
  MENU_CACHE: KvStore;
  /** Local development only, from `.dev.vars`. */
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
