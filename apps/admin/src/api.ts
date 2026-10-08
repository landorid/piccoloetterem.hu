import { getToken } from '@clerk/react';
import { createApiClient } from '@piccolo/api-client';
import { adminApiOrigin, adminAuthorizationHeaders } from './apiAuth';
import { NetworkError } from './errors';

const baseUrl = adminApiOrigin();
if (!baseUrl) {
  throw new Error('VITE_API_URL is not set');
}

/**
 * The admin's client of `apps/api`. Every request carries the signed-in staff member's Clerk
 * session as `Authorization: Bearer` (apiAuth.ts). `getToken` waits for Clerk to load and
 * resolves to null when signed out, so it works outside React.
 *
 * A request that never reaches the API rejects with `NetworkError`, so the error toast can tell
 * it apart from a bug in the caller.
 */
export const api = createApiClient({
  baseUrl,
  headers: () => adminAuthorizationHeaders(getToken),
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new NetworkError({ cause: error });
    }
  },
});
