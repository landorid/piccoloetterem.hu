import { describe, expect, it } from 'vitest';
import { customerRef, dishKey } from './keys';

describe('dishKey', () => {
  it.each([
    ['Piccolo májgaluska levese', 'Piccolo  májgaluskalevese'],
    ['Rántott sertésszelet', 'rántott sertés-szelet'],
    ['Gyümölcsleves', 'GYÜMÖLCSLEVES'],
    ['Túrós csusza, tepertővel', 'Túrós csusza tepertővel.'],
    ['Lecsó (kolbásszal)', 'lecso kolbasszal'],
    ['Bakonyi\tsertésragu\n', ' bakonyi sertésragu'],
    ['Pörkölt 2 db galuskával', 'pörkölt 2db galuskával'],
  ])('joins "%s" and "%s"', (a, b) => {
    expect(dishKey(a)).toBe(dishKey(b));
  });

  it.each([
    ['Rántott csirkemell', 'Rántott csirkecomb'],
    ['Gulyásleves', 'Babgulyás'],
    ['Paradicsomleves', 'Paradicsomos káposzta'],
    ['Somlói galuska', 'Somlói galuska 2'],
  ])('keeps "%s" and "%s" apart', (a, b) => {
    expect(dishKey(a)).not.toBe(dishKey(b));
  });

  it('strips accents, case, whitespace and punctuation', () => {
    expect(dishKey('Piccolo májgaluska levese')).toBe('piccolomajgaluskalevese');
    expect(dishKey('Őszibarack-befőtt, ÚJ!')).toBe('oszibarackbefottuj');
  });

  it('is lossy: long and short vowels collide', () => {
    expect(dishKey('tök')).toBe(dishKey('tok'));
  });

  it('gives an empty key for a name without letters or digits', () => {
    expect(dishKey(' - ')).toBe('');
  });
});

describe('customerRef', () => {
  // Published FNV-1a 64-bit test vectors.
  it.each([
    ['', 'cbf29ce484222325'],
    ['a', 'af63dc4c8601ec8c'],
    ['foobar', '85944171f73967e8'],
  ])('hashes "%s" to %s', (input, hash) => {
    expect(customerRef(input)).toBe(hash);
  });

  it('is 16 lower-case hex characters, stable and distinct per key', () => {
    const ref = customerRef('anna@example.hu');
    expect(ref).toMatch(/^[0-9a-f]{16}$/);
    expect(customerRef('anna@example.hu')).toBe(ref);
    expect(customerRef('anna2@example.hu')).not.toBe(ref);
  });

  it.each(['é', 'ő', '€', '😀', 'kovács.éva@példa.hu'])(
    'hashes the UTF-8 bytes of "%s"',
    (text) => {
      expect(customerRef(text)).toBe(referenceFnv1a(Buffer.from(text, 'utf8')));
    },
  );

  it('pads a hash with leading zeros', () => {
    // FNV-1a of "k0" is below 2^60, so its hex has 15 significant digits.
    expect(customerRef('k0')).toBe('08be0e07b562230e');
  });
});

/** FNV-1a 64 over bytes encoded by Node, to check the hand-written UTF-8 encoder. */
function referenceFnv1a(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
