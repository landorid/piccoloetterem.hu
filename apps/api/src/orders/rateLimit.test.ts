import { describe, expect, it } from 'vitest';
import { memoryKv } from '../menu/memoryKv';
import { clientKey, kvRateLimiter, slide, submissionRule } from './rateLimit';

const minute = 60_000;
const rule = { limit: 3, windowSeconds: 600 };

describe('slide', () => {
  it('allows until the limit, then says when the oldest leaves the window', () => {
    const now = 100 * minute;
    expect(slide([], now, rule)).toEqual({ allowed: true, kept: [], retryAfterSeconds: 0 });
    expect(slide([now - 2 * minute, now - 1 * minute], now, rule).allowed).toBe(true);
    expect(slide([now - 1 * minute, now - 4 * minute, now - 2 * minute], now, rule)).toEqual({
      allowed: false,
      kept: [now - 4 * minute, now - 2 * minute, now - 1 * minute],
      retryAfterSeconds: 6 * 60,
    });
  });

  it('forgets requests older than the window, and ignores stamps from the future', () => {
    const now = 100 * minute;
    expect(slide([now - 10 * minute, now - 11 * minute, now + minute], now, rule)).toEqual({
      allowed: true,
      kept: [],
      retryAfterSeconds: 0,
    });
  });
});

describe('kvRateLimiter', () => {
  it('lets 10 submissions through in 10 minutes, then answers until the first one expires', async () => {
    const kv = memoryKv();
    const limiter = kvRateLimiter(kv, submissionRule, 'order-rate:');
    const start = Date.UTC(2026, 9, 9, 7, 0);
    for (let i = 0; i < 10; i += 1) {
      const decision = await limiter.hit('203.0.113.7', new Date(start + i * 30_000));
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        await decision.recorded;
      }
    }
    expect(await limiter.hit('203.0.113.7', new Date(start + 9 * minute))).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    // Another client has its own count.
    expect((await limiter.hit('203.0.113.8', new Date(start + 9 * minute))).allowed).toBe(true);
    // Ten minutes after the first one, there is room for one more.
    expect((await limiter.hit('203.0.113.7', new Date(start + 10 * minute))).allowed).toBe(true);
    expect(kv.ttls.get('order-rate:203.0.113.7')).toBe(600);
    expect(JSON.parse(kv.data.get('order-rate:203.0.113.7') ?? '[]')).toHaveLength(10);
  });

  it('lets a request through when KV rejects the write, and does not count it', async () => {
    const kv = memoryKv();
    const limiter = kvRateLimiter(kv, rule, 'order-rate:');
    kv.failNextWrites(1);
    const decision = await limiter.hit('203.0.113.7', new Date());
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      await expect(decision.recorded).resolves.toBeUndefined();
    }
    expect(kv.data.size).toBe(0);
  });

  it('reads a damaged value as no requests', async () => {
    const kv = memoryKv();
    await kv.put('order-rate:203.0.113.7', 'not json');
    const limiter = kvRateLimiter(kv, rule, 'order-rate:');
    expect((await limiter.hit('203.0.113.7', new Date())).allowed).toBe(true);
  });
});

describe('clientKey', () => {
  it('keys IPv4 by address and IPv6 by its /64', () => {
    expect(clientKey('203.0.113.7')).toBe('203.0.113.7');
    expect(clientKey('2001:db8:85a3:12:8a2e:370:7334:1')).toBe('2001:db8:85a3:12::/64');
    expect(clientKey('2001:DB8:85A3:0012:abcd::1')).toBe('2001:db8:85a3:12::/64');
    expect(clientKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(clientKey('::')).toBe('0:0:0:0::/64');
  });

  it('keeps an address it cannot read as it is', () => {
    expect(clientKey('::ffff:192.0.2.1')).toBe('::ffff:192.0.2.1');
  });

  it('has no key without an address, or for loopback (wrangler dev)', () => {
    expect(clientKey(undefined)).toBeNull();
    expect(clientKey('  ')).toBeNull();
    expect(clientKey('127.0.0.1')).toBeNull();
    expect(clientKey('::1')).toBeNull();
  });
});
