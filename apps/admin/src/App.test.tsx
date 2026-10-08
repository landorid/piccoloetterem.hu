import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { QueryProvider } from '@/components/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import { paths } from '@/paths';
import { strings } from '@/strings';

const clerk = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  orgId: 'org_piccolo' as string | null,
  memberships: [{ organization: { id: 'org_piccolo' } }],
  setActive: vi.fn(async (_params: { organization: string }) => {}),
  signOut: vi.fn(async (_options: { redirectUrl: string }) => {}),
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: clerk.isLoaded, isSignedIn: clerk.isSignedIn, orgId: clerk.orgId }),
  useClerk: () => ({ signOut: clerk.signOut }),
  useOrganizationList: () => ({
    isLoaded: true,
    setActive: clerk.setActive,
    userMemberships: { isLoading: false, data: clerk.memberships },
  }),
  getToken: async () => (clerk.isSignedIn ? 'session-token' : null),
  SignIn: () => <p>sign-in form</p>,
  UserButton: () => <button type="button">user menu</button>,
}));

type Reply = { status: number; body: unknown };
let replies: Record<string, Reply> = {};
const requests: { path: string; authorization: string | null }[] = [];

let location: ReturnType<typeof useLocation> | undefined;
function LocationProbe() {
  location = useLocation();
  return null;
}

function renderAt(path: string) {
  // The 401 handler reads window.location, as it does under BrowserRouter.
  window.history.replaceState(null, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryProvider>
        <App />
        <LocationProbe />
        <Toaster />
      </QueryProvider>
    </MemoryRouter>,
  );
}

function sidebarState(): string | null | undefined {
  return document.querySelector('[data-slot="sidebar"]')?.getAttribute('data-state');
}

beforeEach(() => {
  Object.assign(clerk, {
    isLoaded: true,
    isSignedIn: true,
    orgId: 'org_piccolo',
    memberships: [{ organization: { id: 'org_piccolo' } }],
  });
  vi.stubEnv('VITE_CLERK_ORG_ID', 'org_piccolo');
  window.innerWidth = 1280;
  replies = {
    '/api/admin/config': { status: 200, body: { name: 'Test Restaurant' } },
    '/api/health': { status: 200, body: { ok: true, version: '1.2.3' } },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({
        path: url.pathname,
        authorization: new Headers(init?.headers).get('authorization'),
      });
      const reply = replies[url.pathname] ?? { status: 404, body: { error: 'not_found' } };
      return new Response(JSON.stringify(reply.body), {
        status: reply.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  requests.length = 0;
  location = undefined;
});

describe('signed in as staff', () => {
  const navLabels = [
    strings.nav.orders,
    strings.nav.summary,
    strings.nav.weeklyMenu,
    strings.nav.items,
  ];

  it.each([
    [paths.orders, strings.pages.orders.title, strings.nav.orders],
    [paths.summary, strings.pages.summary.title, strings.nav.summary],
    [paths.weeklyMenu, strings.pages.weeklyMenu.title, strings.nav.weeklyMenu],
    [paths.items, strings.pages.items.title, strings.nav.items],
  ])('renders %s with its placeholder and the sidebar', async (path, title, activeLabel) => {
    renderAt(path);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(strings.placeholder.title)).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: strings.nav.label });
    for (const label of navLabels) {
      const link = within(nav).getByRole('link', { name: label });
      expect(link.getAttribute('data-active')).toBe(String(label === activeLabel));
    }
  });

  it('redirects / to /rendelesek', async () => {
    renderAt(paths.home);

    expect(
      await screen.findByRole('heading', { level: 1, name: strings.pages.orders.title }),
    ).toBeTruthy();
    expect(location?.pathname).toBe(paths.orders);
  });

  it('renders the login route without the sidebar', async () => {
    clerk.isSignedIn = false;
    renderAt(paths.login);

    expect(await screen.findByText('sign-in form')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows an unknown path as not found, inside the layout', async () => {
    renderAt('/nincs-ilyen');

    expect(await screen.findByText(strings.notFound.title)).toBeTruthy();
    expect(screen.getByRole('navigation', { name: strings.nav.label })).toBeTruthy();
    expect(screen.getByRole('link', { name: strings.notFound.back }).getAttribute('href')).toBe(
      paths.orders,
    );
  });

  it('shows the restaurant name from the API, sending the session as a bearer token', async () => {
    renderAt(paths.orders);

    expect(await screen.findByText('Test Restaurant')).toBeTruthy();
    expect(await screen.findByText('1.2.3')).toBeTruthy();
    expect(requests).toContainEqual({
      path: '/api/admin/config',
      authorization: 'Bearer session-token',
    });
  });

  it('collapses the sidebar to its icons at 800px; the trigger opens it', async () => {
    window.innerWidth = 800;
    renderAt(paths.orders);
    await screen.findByRole('heading', { level: 1, name: strings.pages.orders.title });

    expect(sidebarState()).toBe('collapsed');
    const trigger = document.querySelector('[data-sidebar="trigger"]');
    expect(trigger?.getAttribute('aria-label')).toBe(strings.sidebar.toggle);
    if (!trigger) {
      throw new Error('no sidebar trigger');
    }
    fireEvent.click(trigger);
    expect(sidebarState()).toBe('expanded');
  });

  it('keeps the sidebar open at 1280px', async () => {
    renderAt(paths.orders);
    await screen.findByRole('heading', { level: 1, name: strings.pages.orders.title });

    expect(sidebarState()).toBe('expanded');
  });

  it('shows an error toast with a Hungarian message and the code', async () => {
    replies['/api/admin/config'] = { status: 403, body: { error: 'forbidden' } };
    renderAt(paths.orders);

    expect(await screen.findByText(strings.errors.byCode.forbidden)).toBeTruthy();
    expect(screen.getByText(`${strings.errors.codeLabel}: forbidden`)).toBeTruthy();
  });

  it('signs out on a 401 and returns to the same page after sign-in', async () => {
    replies['/api/admin/config'] = { status: 401, body: { error: 'unauthenticated' } };
    renderAt(paths.weeklyMenu);

    await waitFor(() => expect(clerk.signOut).toHaveBeenCalledTimes(1));
    const redirectUrl = new URL(
      clerk.signOut.mock.calls[0]?.[0].redirectUrl ?? '',
      window.location.origin,
    );
    expect(redirectUrl.pathname).toBe(paths.login);
    expect(redirectUrl.searchParams.get('redirect_url')).toBe(
      `${window.location.origin}${paths.weeklyMenu}`,
    );
    expect(screen.queryByText(`${strings.errors.codeLabel}: unauthenticated`)).toBeNull();
  });
});

describe('signed out', () => {
  it('sends /heti-menu to /login, set to return to /heti-menu', async () => {
    clerk.isSignedIn = false;
    renderAt(paths.weeklyMenu);

    expect(await screen.findByText('sign-in form')).toBeTruthy();
    expect(location?.pathname).toBe(paths.login);
    expect(new URLSearchParams(location?.search).get('redirect_url')).toBe(
      `${window.location.origin}${paths.weeklyMenu}`,
    );
    expect(requests).toEqual([]);
  });
});

describe('signed in, not staff', () => {
  it('shows no access with a sign-out button instead of a spinner', async () => {
    clerk.orgId = null;
    clerk.memberships = [{ organization: { id: 'org_other' } }];
    renderAt(paths.orders);

    expect(await screen.findByText(strings.noAccess.title)).toBeTruthy();
    expect(screen.getByText(strings.noAccess.notMember)).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: strings.signOut }));
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: paths.login });
    expect(requests).toEqual([]);
  });

  it('shows no access when VITE_CLERK_ORG_ID is not set', async () => {
    vi.stubEnv('VITE_CLERK_ORG_ID', '');
    renderAt(paths.orders);

    expect(await screen.findByText(strings.noAccess.notMember)).toBeTruthy();
  });

  it('activates the organization of a member before any API call', async () => {
    clerk.orgId = null;
    renderAt(paths.orders);

    await waitFor(() =>
      expect(clerk.setActive).toHaveBeenCalledWith({ organization: 'org_piccolo' }),
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(requests).toEqual([]);
  });

  it('shows no access when activating the organization fails', async () => {
    clerk.orgId = null;
    clerk.setActive.mockRejectedValueOnce(new Error('network'));
    renderAt(paths.orders);

    expect(await screen.findByText(strings.noAccess.activationFailed)).toBeTruthy();
  });
});
