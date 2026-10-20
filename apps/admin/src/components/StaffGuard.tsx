import { useAuth, useClerk, useOrganizationList } from '@clerk/react';
import { LogOut, ShieldX } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { loginPath, paths } from '@/paths';
import { strings } from '@/strings';

function FullPageLoading() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <LoadingState />
    </main>
  );
}

/** Signed in, but not staff: the account is not a member of the org, or it cannot be opened. */
function NoAccess({ reason }: { reason: 'not_member' | 'activation_failed' }) {
  const { signOut } = useClerk();

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        icon={ShieldX}
        title={strings.noAccess.title}
        description={
          reason === 'not_member' ? strings.noAccess.notMember : strings.noAccess.activationFailed
        }
        action={
          <Button variant="outline" onClick={() => void signOut({ redirectUrl: paths.login })}>
            <LogOut />
            {strings.signOut}
          </Button>
        }
        className="max-w-lg"
      />
    </main>
  );
}

/**
 * Staff is membership of `VITE_CLERK_ORG_ID`. A member gets that organization activated before
 * any API call, because the API reads the org from the session token (apps/api README).
 */
function OrgGuard({ children }: { children: ReactNode }) {
  const configuredOrgId = import.meta.env.VITE_CLERK_ORG_ID;
  const { isLoaded: authLoaded, orgId } = useAuth();
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: true,
  });
  const [activationFailed, setActivationFailed] = useState(false);

  const membershipsReady =
    userMemberships.isLoading === false && userMemberships.data !== undefined;
  const memberships = userMemberships.data ?? [];
  const isMember = Boolean(
    configuredOrgId &&
      memberships.some((membership) => membership.organization.id === configuredOrgId),
  );

  useEffect(() => {
    if (
      !isLoaded ||
      !authLoaded ||
      !membershipsReady ||
      !setActive ||
      !isMember ||
      !configuredOrgId ||
      activationFailed ||
      orgId === configuredOrgId
    ) {
      return;
    }
    void setActive({ organization: configuredOrgId }).catch(() => setActivationFailed(true));
  }, [activationFailed, authLoaded, isLoaded, isMember, membershipsReady, orgId, setActive]);

  if (!authLoaded || !isLoaded || !membershipsReady) {
    return <FullPageLoading />;
  }
  if (!isMember) {
    return <NoAccess reason="not_member" />;
  }
  if (activationFailed) {
    return <NoAccess reason="activation_failed" />;
  }
  if (orgId !== configuredOrgId) {
    return <FullPageLoading />;
  }
  return children;
}

/**
 * The route element above every staff screen. Signed out → the sign-in page, which returns here
 * afterwards. Signed in → the org check, then the screen.
 */
export function RequireStaff() {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return <FullPageLoading />;
  }
  if (!isSignedIn) {
    return <Navigate to={loginPath(location)} replace />;
  }
  return (
    <OrgGuard>
      <Outlet />
    </OrgGuard>
  );
}
