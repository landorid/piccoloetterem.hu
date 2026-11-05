/**
 * The key that joins one dish across weeks and across the old and new systems: the name in Unicode
 * NFD with combining marks stripped, lower-cased, keeping only letters and digits. So
 * `"Piccolo májgaluska levese"` and `"Piccolo  májgaluskalevese"` share `piccolomajgaluskalevese`.
 *
 * The key is lossy (`tök` and `tok` collide) and must stay stable: changing it changes every join
 * and every stored `dish_key`, so a change bumps `LegacyStatsFile.formatVersion`.
 */
export function dishKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

const fnvOffsetBasis = 0xcbf29ce484222325n;
const fnvPrime = 0x100000001b3n;
const mask64 = 0xffffffffffffffffn;

/**
 * A customer's id in URLs: 64-bit FNV-1a over the UTF-8 bytes of the email key, as 16 lower-case
 * hex characters. It keeps emails out of URLs and logs; it is not a security boundary.
 */
export function customerRef(emailKey: string): string {
  let hash = fnvOffsetBasis;
  for (const byte of utf8(emailKey)) {
    hash = ((hash ^ BigInt(byte)) * fnvPrime) & mask64;
  }
  return hash.toString(16).padStart(16, '0');
}

/** UTF-8 bytes of `text`; core has no DOM or Node types, so no `TextEncoder`. */
function* utf8(text: string): Generator<number> {
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) {
      yield code;
    } else if (code < 0x800) {
      yield 0xc0 | (code >> 6);
      yield 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      yield 0xe0 | (code >> 12);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    } else {
      yield 0xf0 | (code >> 18);
      yield 0x80 | ((code >> 12) & 0x3f);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    }
  }
}
