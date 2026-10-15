import type { R2Store } from '../env';

/**
 * An `R2Store` in memory, for tests, like `menu/memoryKv.ts`. `failPut(n)` makes the n-th put
 * from now (1 = the next one) throw once; `failDeletes()` makes every delete throw. `log` records
 * every successful write as `put <key>` or `delete <key>`.
 */
export function memoryR2() {
  const data = new Map<
    string,
    { bytes: Blob; contentType: string | undefined; cacheControl: string | undefined }
  >();
  const log: string[] = [];
  let putsUntilFailure = 0;
  let failingDeletes = false;

  const bucket: R2Store = {
    async put(key, value, options) {
      if (putsUntilFailure > 0 && --putsUntilFailure === 0) {
        throw new Error('R2 put failed');
      }
      data.set(key, {
        bytes: value,
        contentType: options?.httpMetadata?.contentType,
        cacheControl: options?.httpMetadata?.cacheControl,
      });
      log.push(`put ${key}`);
    },
    async delete(keys) {
      if (failingDeletes) {
        throw new Error('R2 delete failed');
      }
      for (const key of keys) {
        data.delete(key);
        log.push(`delete ${key}`);
      }
    },
  };

  return {
    ...bucket,
    data,
    log,
    failPut(nth: number) {
      putsUntilFailure = nth;
    },
    failDeletes(fail = true) {
      failingDeletes = fail;
    },
  };
}
