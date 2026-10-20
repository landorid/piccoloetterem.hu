/** Trimmed, lowercased email, the `customers.email_key`. Does not validate. */
export function normaliseEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

const separators = /[\s./()-]/g;
const emailPattern = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/;
const mobile = /^(20|30|31|50|70)\d{7}$/;
const budapest = /^1\d{7}$/;
const geographic = /^[2-9]\d{7,8}$/;
const mobilePrefix = /^(20|30|31|50|70)/;

/** RFC-ish address that also requires a dot in the domain. */
export function isEmail(email: string): boolean {
  return emailPattern.test(email);
}

/**
 * Hungarian phone numbers to E.164 (`+36…`). Accepts a leading `+36`, `0036`, `36` or `06`, or a
 * bare national number, with spaces, slashes, dots, dashes or brackets. Returns `null` when the
 * number cannot be a Hungarian mobile, Budapest or other geographic number.
 */
export function normalisePhone(raw: string): string | null {
  const compact = raw.trim().replace(separators, '');
  if (compact === '') {
    return null;
  }

  const national = nationalNumber(compact);
  if (national === null || !isHungarianNational(national)) {
    return null;
  }
  return `+36${national}`;
}

/**
 * What a staff search for `query` looks for inside a stored phone number, which `normalisePhone`
 * keeps as `+36…`: the query without separators, with a leading `06` or `0036` written as `+36`.
 * Partial numbers are fine (`30 123` → `30123`). `null` when the query is not a phone number at
 * all, such as a name.
 */
export function phoneSearchFragment(query: string): string | null {
  const compact = query.trim().replace(separators, '');
  if (!/^\+?\d+$/.test(compact)) {
    return null;
  }
  if (compact.startsWith('0036')) {
    return `+36${compact.slice(4)}`;
  }
  if (compact.startsWith('06')) {
    return `+36${compact.slice(2)}`;
  }
  return compact;
}

function nationalNumber(compact: string): string | null {
  if (compact.startsWith('+')) {
    return compact.startsWith('+36') ? compact.slice(3) : null;
  }
  if (compact.startsWith('00')) {
    return compact.startsWith('0036') ? compact.slice(4) : null;
  }
  if (compact.startsWith('06')) {
    return compact.slice(2);
  }
  if (compact.startsWith('36') && isHungarianNational(compact.slice(2))) {
    return compact.slice(2);
  }
  return compact;
}

function isHungarianNational(nsn: string): boolean {
  if (!/^\d+$/.test(nsn)) {
    return false;
  }
  if (mobile.test(nsn) || budapest.test(nsn)) {
    return true;
  }
  return geographic.test(nsn) && !mobilePrefix.test(nsn);
}
