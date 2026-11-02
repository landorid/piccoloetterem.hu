import { useAuth } from '@clerk/react';

/**
 * Whether the session holds the organization's `org:admin` role, the only role that sees the
 * statistics (docs/PLAN.md §2). The API enforces the same rule on `/api/admin/stats/*`.
 */
export function useIsOrgAdmin(): boolean {
  const { has } = useAuth();
  return has?.({ role: 'org:admin' }) ?? false;
}
