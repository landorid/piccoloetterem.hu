import {
  RedirectToSignIn,
  Show,
  SignIn,
  useAuth,
  useClerk,
  useOrganizationList,
} from '@clerk/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminApiOrigin, adminAuthorizationHeaders } from './apiAuth';
import { strings } from './strings';

const loginPath = '/admin/login';

function isLoginPath(path: string): boolean {
  return path === loginPath || path.startsWith(`${loginPath}/`);
}

function usePathname(): string {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const notify = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', notify);
    const { pushState, replaceState } = window.history;
    window.history.pushState = function pushStateAndNotify(...args) {
      pushState.apply(this, args);
      notify();
    };
    window.history.replaceState = function replaceStateAndNotify(...args) {
      replaceState.apply(this, args);
      notify();
    };
    return () => {
      window.removeEventListener('popstate', notify);
      window.history.pushState = pushState;
      window.history.replaceState = replaceState;
    };
  }, []);

  return pathname;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy="true">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground" />
    </div>
  );
}

function OrgGuard({ children }: { children: React.ReactNode }) {
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
      activationFailed
    ) {
      return;
    }
    if (orgId === configuredOrgId) {
      return;
    }
    void setActive({ organization: configuredOrgId }).catch(() => setActivationFailed(true));
  }, [activationFailed, authLoaded, isLoaded, isMember, membershipsReady, orgId, setActive]);

  if (
    !authLoaded ||
    !isLoaded ||
    !membershipsReady ||
    (isMember && orgId !== configuredOrgId && !activationFailed)
  ) {
    return <LoadingScreen />;
  }

  if (!isMember || activationFailed) {
    return <LoadingScreen />;
  }

  return children;
}

function SignOutButton() {
  const { signOut } = useClerk();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void signOut({ redirectUrl: loginPath })}
    >
      {strings.signOut}
    </Button>
  );
}

function Ping() {
  const { getToken } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const origin = adminApiOrigin();
    if (!origin) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const headers = await adminAuthorizationHeaders(() => getToken({ skipCache: true }));
      const response = await fetch(`${origin}/api/admin/ping`, { headers });
      if (!response.ok) {
        throw new Error(`ping ${response.status}`);
      }
      const body = (await response.json()) as { userId?: unknown };
      if (typeof body.userId !== 'string') {
        throw new Error('ping body');
      }
      if (!cancelled) {
        setUserId(body.userId);
      }
    })().catch(() => {
      if (!cancelled) {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  if (failed) {
    return <p className="text-muted-foreground">{strings.apiUnreachable}</p>;
  }
  if (!userId) {
    return null;
  }
  return (
    <p>
      {strings.signedIn} <code>{userId}</code>
    </p>
  );
}

function Shell() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">{strings.appName}</span>
        <SignOutButton />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <h1 className="font-semibold text-2xl">{strings.heading}</h1>
        <Ping />
      </main>
    </div>
  );
}

function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <SignIn routing="path" path={loginPath} fallbackRedirectUrl="/" />
    </main>
  );
}

export function App() {
  const pathname = usePathname();

  if (isLoginPath(pathname)) {
    return <LoginPage />;
  }

  return (
    <>
      <Show when="signed-in">
        <OrgGuard>
          <Shell />
        </OrgGuard>
      </Show>
      <Show when="signed-out">
        <LoadingScreen />
        <RedirectToSignIn />
      </Show>
    </>
  );
}
