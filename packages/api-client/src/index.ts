import type { AppType } from '@piccolo/api/types';
import { type ClientRequestOptions, type ClientResponse, hc } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';

/**
 * Typed client of `apps/api`, shared by both frontends. Only the route types come from
 * `@piccolo/api/types`; the import is type-only, so no Worker code reaches a frontend bundle.
 *
 * The frontends typecheck the API's source through `AppType`, without `@cloudflare/workers-types`
 * (it clashes with the DOM lib). Every Workers global the API's `Bindings` name must be declared
 * here, structurally and only as far as the API uses it.
 */
declare global {
  interface Hyperdrive {
    readonly connectionString: string;
  }
}

export type { AppType };

export type ApiClientOptions = {
  /** API origin, e.g. `https://api.<domain>`. Routes start with `/api`. */
  baseUrl: string;
  fetch?: ClientRequestOptions['fetch'];
  headers?: ClientRequestOptions['headers'];
};

export function createApiClient(options: ApiClientOptions) {
  return hc<AppType>(options.baseUrl, {
    fetch: options.fetch,
    headers: options.headers,
  });
}

/**
 * A non-2xx API response. `code` is the body's `error` (see apps/api/src/app.ts), or `'unknown'`
 * when the body has none; the frontends map it to Hungarian copy. `fields` is set on
 * `validation` failures: invalid path → zod issue code. `message` is for developers only.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The body of the 2xx members of a route's response union. */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'>
    ? S extends SuccessStatusCode
      ? T
      : never
    : never;

/** The JSON body of a 2xx response; otherwise throws `ApiError`. */
export async function unwrap<R extends ClientResponse<unknown, number, 'json'>>(
  response: R,
): Promise<SuccessBody<R>> {
  if (response.ok) {
    return (await response.json()) as SuccessBody<R>;
  }

  let code = 'unknown';
  let message = response.statusText;
  let fields: Record<string, string> | undefined;
  try {
    const body = (await response.json()) as {
      error?: unknown;
      message?: unknown;
      fields?: unknown;
    };
    if (typeof body.error === 'string' && body.error !== '') {
      code = body.error;
    }
    if (typeof body.message === 'string' && body.message !== '') {
      message = body.message;
    }
    fields = stringMap(body.fields);
  } catch {
    // Not JSON. The status and statusText still describe the failure.
  }
  throw new ApiError(response.status, code, message, fields);
}

function stringMap(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  if (!entries.every((entry): entry is [string, string] => typeof entry[1] === 'string')) {
    return undefined;
  }
  return Object.fromEntries(entries);
}
