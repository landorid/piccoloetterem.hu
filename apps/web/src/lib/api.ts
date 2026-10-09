import { ApiError, createApiClient, unwrap } from '@piccolo/api-client';

export { ApiError };

/** A request that never reached the API: offline, DNS, or blocked by CORS. */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('The API could not be reached', options);
    this.name = 'NetworkError';
  }
}

/**
 * The API origin, `https://api.<domain>`. `PUBLIC_API_URL` is inlined at build time, so the page
 * and the island agree on it. `astro dev` defaults to the local Worker; a build without it has
 * none, and the page renders without the API.
 */
export function apiOrigin(): string | null {
  const configured = import.meta.env.PUBLIC_API_URL;
  if (configured) {
    return configured;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return null;
}

/**
 * The public site's client of `apps/api`. Requests carry no headers of their own, so a browser
 * `GET` stays a simple CORS request (no preflight), and the default cache mode lets the browser
 * revalidate `GET /api/menu` with its ETag and take the 304. Never set `If-None-Match` by hand:
 * the API does not allow it as a CORS request header.
 */
export function createWebApi(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  return createApiClient({
    baseUrl,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        return await fetchImpl(input, init);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw error;
        }
        throw new NetworkError({ cause: error });
      }
    },
  });
}

export type WebApi = ReturnType<typeof createWebApi>;

/** `GET /api/config/public`: the restaurant's name, contact, prices and extras. */
export async function loadPublicConfig(api: WebApi) {
  return unwrap(await api.api.config.public.$get());
}

export type PublicConfig = Awaited<ReturnType<typeof loadPublicConfig>>;

/** `GET /api/menu`: the current week as guests see it, in one of three states. */
export async function loadMenu(api: WebApi, init?: RequestInit) {
  return unwrap(await api.api.menu.$get({ query: {} }, { init }));
}

export type MenuResponse = Awaited<ReturnType<typeof loadMenu>>;
export type OpenMenu = Extract<MenuResponse, { state: 'open' }>;
export type PublicMenu = OpenMenu['menu'];
export type PublicMenuItem = PublicMenu['featured'][number];
