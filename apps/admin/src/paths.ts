/**
 * Every admin route. The admin is served at the root of `admin.<domain>`, so there is no
 * `/admin` prefix: the hostname already says it.
 */
export const paths = {
  home: '/',
  login: '/login',
  orders: '/rendelesek',
  summary: '/osszesito',
  weeklyMenu: '/heti-menu',
  items: '/etlap',
  /** The statistics, for `org:admin` only. */
  stats: {
    overview: '/statisztika',
    dishes: '/statisztika/fogasok',
    dish: '/statisztika/fogasok/:dishKey',
    customers: '/statisztika/vevok',
    customer: '/statisztika/vevok/:ref',
  },
} as const;

/**
 * The sign-in page, set to return to `returnTo` afterwards. Clerk's `<SignIn>` reads
 * `redirect_url` and follows it only to allowed origins, by default this one.
 */
export function loginPath(
  returnTo: { pathname: string; search: string; hash: string },
  origin: string = window.location.origin,
): string {
  const target = new URL(`${returnTo.pathname}${returnTo.search}${returnTo.hash}`, origin);
  return `${paths.login}?${new URLSearchParams({ redirect_url: target.href })}`;
}
