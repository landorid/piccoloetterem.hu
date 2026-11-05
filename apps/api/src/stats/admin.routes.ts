import { Hono } from 'hono';
import { requireOrgAdmin } from '../auth';
import type { AppEnv } from '../env';

/**
 * The statistics, mounted at `/api/admin/stats` behind `requireStaff`. Every route is for the
 * organization's `org:admin` role only; any other member gets 403.
 */
export function adminStatsRoutes() {
  return (
    new Hono<AppEnv>()
      .use(requireOrgAdmin)

      // Whether the session may see the statistics: 204, else 403 from `requireOrgAdmin`.
      .get('/access', (c) => c.body(null, 204))
  );
}
