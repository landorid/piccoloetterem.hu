import { createClerkClient } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from './env';

function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** Clerk only treats `Authorization: Bearer <token>` as a session. Anything else is no session. */
function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(' ', 2);
  if (scheme !== 'Bearer' || !token) {
    return undefined;
  }
  return token;
}

/**
 * Guards `/api/admin/*`. Staff and the API are on different origins, so the
 * session arrives as `Authorization: Bearer`. `authenticateRequest` reads that
 * header. No session → 401. A session whose `orgId` is not `CLERK_ORG_ID` → 403.
 * On success `c.get('staff')` is `{ userId, orgId }`.
 *
 * `orgId` is taken from the session token only. Clerk omits it when the user
 * has no active organization, and an empty `authorizedParties` list makes Clerk
 * skip the `azp` check, so a missing list fails closed.
 */
export const requireStaff = createMiddleware<AppEnv>(async (c, next) => {
  // No bearer token is no session. Do this before Clerk so a missing publishable
  // key cannot turn `curl` without a token into a 500.
  if (!bearerToken(c.req.header('authorization'))) {
    return c.json({ error: 'unauthenticated' as const }, 401);
  }

  const authorizedParties = splitList(c.env.CLERK_AUTHORIZED_PARTIES);
  if (authorizedParties.length === 0) {
    throw new Error('CLERK_AUTHORIZED_PARTIES is not set');
  }

  const clerk = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
    publishableKey: c.env.CLERK_PUBLISHABLE_KEY,
  });
  const state = await clerk.authenticateRequest(c.req.raw, {
    authorizedParties,
    acceptsToken: 'session_token',
  });
  if (!state.isAuthenticated) {
    return c.json({ error: 'unauthenticated' as const }, 401);
  }

  const auth = state.toAuth();
  const userId = auth.userId;
  const orgId = auth.orgId;
  const expectedOrgId = c.env.CLERK_ORG_ID;
  if (!userId || !orgId || !expectedOrgId || orgId !== expectedOrgId) {
    return c.json({ error: 'forbidden' as const }, 403);
  }

  c.set('staff', { userId, orgId });
  await next();
});
