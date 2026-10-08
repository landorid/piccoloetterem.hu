import { useClerk } from '@clerk/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { loginPath } from '@/paths';
import { createQueryClient } from '@/queryClient';

/**
 * TanStack Query for the admin. A 401 from the API signs the user out and sends them to
 * `/login`, set to return to the current page. Signing out first matters: Clerk's sign-in page
 * sends a still signed-in user straight back, and the 401 would repeat forever.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  const [client] = useState(() => {
    let signingOut = false;
    return createQueryClient({
      onUnauthenticated: () => {
        if (signingOut) {
          return;
        }
        signingOut = true;
        void clerk.signOut({ redirectUrl: loginPath(window.location) }).finally(() => {
          signingOut = false;
        });
      },
    });
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
