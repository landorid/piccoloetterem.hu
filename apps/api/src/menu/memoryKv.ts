import type { KvStore } from '../env';

/**
 * A `KvStore` in memory, for tests. Unlike Workers KV it is immediately consistent, and it records
 * `expirationTtl` in `ttls` without expiring anything. `failNextWrites(n)` makes the next `n`
 * writes throw, the way KV rejects more than one write per second to a key. `stats.writes` counts
 * every write attempt.
 */
export function memoryKv() {
  const data = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  const stats = { writes: 0 };
  let failures = 0;
  const kv: KvStore = {
    async get(key) {
      return data.get(key) ?? null;
    },
    async put(key, value, options) {
      stats.writes += 1;
      if (failures > 0) {
        failures -= 1;
        throw new Error('KV PUT failed: 429 Too Many Requests');
      }
      data.set(key, value);
      ttls.set(key, options?.expirationTtl);
    },
  };
  return {
    ...kv,
    data,
    ttls,
    stats,
    failNextWrites(count: number) {
      failures = count;
    },
  };
}
