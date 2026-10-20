import type { Bindings, KvStore } from '../env';

/**
 * The per-IP limit on `POST /api/orders`: at most `limit` submissions in any `windowSeconds`.
 *
 * Kept in Workers KV, in the `MENU_CACHE` namespace under the `order-rate:` prefix, so it needs no
 * resource of its own. One key per client holds the times of its recent submissions (a sliding
 * window), and expires `windowSeconds` after the last one.
 *
 * Trade-offs, accepted for an abuse brake in front of the database (it is not an accounting
 * system):
 * - KV is eventually consistent. A write is visible at once in the Cloudflare location that made
 *   it and within about a minute elsewhere; one client is normally served by one location.
 * - Read, then write, is not atomic: concurrent requests from one client can each see the same
 *   count, and KV rejects more than about one write per second to a key. A burst can therefore
 *   get a few requests past the limit before it applies.
 * - The Workers Rate Limiting binding avoids both, but its period can only be 10 or 60 seconds,
 *   so it cannot express 10 per 10 minutes. A Durable Object would be exact; the issue does not
 *   require one.
 */
export interface RateRule {
  limit: number;
  windowSeconds: number;
}

/** 10 submissions per 10 minutes per client (#31, Scope 6). */
export const submissionRule: RateRule = { limit: 10, windowSeconds: 600 };

export type RateDecision =
  /** `recorded` settles when this request has been counted; it never rejects. */
  { allowed: true; recorded: Promise<void> } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Counts one request of `client` at `now`, unless it is over the limit. */
  hit(client: string, now: Date): Promise<RateDecision>;
}

/** Never limits. */
export const noRateLimit: RateLimiter = {
  async hit() {
    return { allowed: true, recorded: Promise.resolve() };
  },
};

/**
 * The sliding window: the times (ms) of `stamps` still inside the window that ends at `now`, and
 * whether one more request fits. When it does not, `retryAfterSeconds` is when the oldest counted
 * request leaves the window.
 */
export function slide(
  stamps: readonly number[],
  now: number,
  rule: RateRule,
): { allowed: boolean; kept: number[]; retryAfterSeconds: number } {
  const windowMs = rule.windowSeconds * 1000;
  const kept = stamps
    .filter((stamp) => stamp > now - windowMs && stamp <= now)
    .sort((a, b) => a - b);
  if (kept.length < rule.limit) {
    return { allowed: true, kept, retryAfterSeconds: 0 };
  }
  // One more fits once every stamp up to this one has left the window.
  const oldest = kept[kept.length - rule.limit] ?? now;
  return { allowed: false, kept, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
}

function parseStamps(stored: string | null): number[] {
  if (stored === null) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(stored);
    return Array.isArray(value) ? value.filter((stamp) => typeof stamp === 'number') : [];
  } catch {
    return [];
  }
}

/** `RateLimiter` on Workers KV; see `RateRule` for what it guarantees. */
export function kvRateLimiter(kv: KvStore, rule: RateRule, prefix: string): RateLimiter {
  return {
    async hit(client, now) {
      const key = `${prefix}${client}`;
      const at = now.getTime();
      const { allowed, kept, retryAfterSeconds } = slide(
        parseStamps(await kv.get(key, 'text')),
        at,
        rule,
      );
      if (!allowed) {
        return { allowed: false, retryAfterSeconds };
      }
      // Only the last `limit` matter; the oldest beyond them have no effect on the next decision.
      const stamps = [...kept, at].slice(-rule.limit);
      const recorded = kv
        .put(key, JSON.stringify(stamps), { expirationTtl: rule.windowSeconds })
        .catch((err) => {
          // Most likely KV's one write per second per key: a burst from this client.
          console.warn(`Rate limit: could not record ${key}`, err);
        });
      return { allowed: true, recorded };
    },
  };
}

/** The submission limiter of this deployment, in the `MENU_CACHE` namespace. */
export function submissionLimiterFor(env: Bindings): RateLimiter {
  return kvRateLimiter(env.MENU_CACHE, submissionRule, 'order-rate:');
}

/**
 * Who a request counts against: the client IP Cloudflare puts in `CF-Connecting-IP`, an IPv6
 * address cut to its /64 (one subscriber's network, where the low bits are free to change).
 *
 * `null`, so the route does not limit, without the header (tests) and for a loopback address:
 * `wrangler dev` reports the developer's own machine, which Cloudflare never does, and limiting it
 * would stop local checkout testing after ten submissions.
 */
export function clientKey(connectingIp: string | undefined): string | null {
  const ip = connectingIp?.trim().toLowerCase();
  if (!ip || ip === '::1' || ip.startsWith('127.')) {
    return null;
  }
  if (!ip.includes(':')) {
    return ip;
  }
  const groups = expandIpv6(ip);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : ip;
}

/** The eight 16-bit groups of an IPv6 address, without leading zeros; `null` when malformed. */
function expandIpv6(ip: string): string[] | null {
  const halves = ip.split('::');
  if (halves.length > 2) {
    return null;
  }
  const parse = (part: string | undefined) => (part ? part.split(':') : []);
  const head = parse(halves[0]);
  const tail = parse(halves[1]);
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) {
    return null;
  }
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
    return null;
  }
  return groups.map((group) => group.replace(/^0+(?=.)/, ''));
}
