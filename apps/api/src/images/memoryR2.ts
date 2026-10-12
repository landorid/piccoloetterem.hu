import type { R2Store } from '../env';

/**
 * An `R2Store` in memory, for tests, like `menu/memoryKv.ts`. `failPut(n)` makes the n-th put
 * from now (1 = the next one) throw once; `failDeletes()` makes every delete throw. `log` records
 * every successful write as `put <key>` or `delete <key>`; `reads` every key asked for.
 */
export function memoryR2() {
  const data = new Map<string, { bytes: Blob; contentType: string | undefined }>();
  const log: string[] = [];
  const reads: string[] = [];
  let putsUntilFailure = 0;
  let failingDeletes = false;

  const bucket: R2Store = {
    async get(key) {
      reads.push(key);
      const object = data.get(key);
      if (!object) {
        return null;
      }
      return {
        body: object.bytes.stream(),
        size: object.bytes.size,
        httpEtag: `"${key}"`,
        httpMetadata: { contentType: object.contentType },
      };
    },
    async put(key, value, options) {
      if (putsUntilFailure > 0 && --putsUntilFailure === 0) {
        throw new Error('R2 put failed');
      }
      data.set(key, { bytes: value, contentType: options?.httpMetadata?.contentType });
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
    reads,
    failPut(nth: number) {
      putsUntilFailure = nth;
    },
    failDeletes(fail = true) {
      failingDeletes = fail;
    },
  };
}
