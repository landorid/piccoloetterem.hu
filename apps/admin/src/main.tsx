import { huHU } from '@clerk/localizations';
import { ClerkProvider } from '@clerk/react';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, useNavigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { App } from './App';
import { QueryProvider } from './components/QueryProvider';
import { Toaster } from './components/ui/sonner';
import { paths } from './paths';
import { strings } from './strings';
import './index.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
if (!publishableKey) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set');
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing from index.html');
}

/** Clerk navigates through React Router, so sign-in steps and sign-out stay inside the SPA. */
function ClerkWithRouter({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={huHU}
      signInUrl={paths.login}
      afterSignOutUrl={paths.login}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      {children}
    </ClerkProvider>
  );
}

/**
 * A data router, so a page can hold a navigation back (`useBlocker`: the weekly menu asks before
 * dropping unsaved changes). Its one splat route renders `App`, whose `<Routes>` match the rest.
 */
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <ClerkWithRouter>
        <QueryProvider>
          <App />
          {/* No dark mode: the toasts follow the light theme, not the OS. */}
          <Toaster theme="light" containerAriaLabel={strings.toaster.label} />
        </QueryProvider>
      </ClerkWithRouter>
    ),
  },
]);

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
