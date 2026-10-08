/**
 * `Authorization` header for admin API calls.
 *
 * The admin Worker (`admin.<domain>`) and the API Worker (`api.<domain>`) are
 * different origins, so the Clerk session is sent as a bearer token. Cookies
 * are not used.
 *
 * Shaped for the `headers` callback of `createApiClient` (`@piccolo/api-client`);
 * issue #26 wires it into the admin's API client:
 *
 * ```ts
 * const { getToken } = useAuth();
 * createApiClient({
 *   baseUrl,
 *   headers: () => adminAuthorizationHeaders(() => getToken()),
 * });
 * ```
 */
export async function adminAuthorizationHeaders(
  getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

/** API origin. Dev defaults to the local Worker; production builds must set `VITE_API_URL`. */
export function adminApiOrigin(): string | null {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return null;
}
