// Stands in for `@clerk/react` in the admin under verification (admin-vite.config.mjs aliases it).
// Signed in as a member of VITE_CLERK_ORG_ID; `getToken` hands the API the run's staff token, which
// the real `requireStaff` verifies. Covers exactly the exports apps/admin imports; a new import
// from `@clerk/react` fails the admin's build here until it is added.
// No imports and no JSX: this file lives outside apps/admin, where `react` does not resolve.

const orgId = import.meta.env.VITE_CLERK_ORG_ID;
const token = import.meta.env.VITE_VERIFY_STAFF_TOKEN;

const signOut = async () => {
  console.info('[verify] Clerk signOut called (stub: still signed in)');
};

export const ClerkProvider = ({ children }) => children;
export const SignIn = () => null;
export const UserButton = () => null;

export const getToken = async () => token;

export const useAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  userId: 'user_verify',
  orgId,
  getToken,
});

export const useClerk = () => ({ signOut });

export const useOrganizationList = () => ({
  isLoaded: true,
  setActive: async () => {},
  userMemberships: { isLoading: false, data: [{ organization: { id: orgId } }] },
});
