import { SignIn } from '@clerk/react';
import { paths } from '@/paths';

/**
 * Clerk's sign-in, Hungarian through `huHU`. It returns to `redirect_url` when the guard set
 * one, otherwise to the orders.
 */
export function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <SignIn routing="path" path={paths.login} fallbackRedirectUrl={paths.home} />
    </main>
  );
}
