/**
 * The recipient's domain when `EMAIL_ALLOWED_RECIPIENT_DOMAINS` does not allow it, otherwise
 * `null`. Unset or empty allows every recipient (production); a verify run sets it to the test
 * inbox's domain, so a run holding the SES keys can mail nothing else.
 */
export function disallowedRecipientDomain(to: string, allowed: string | undefined): string | null {
  const domains = (allowed ?? '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  if (domains.length === 0) return null;
  const domain = to
    .slice(to.lastIndexOf('@') + 1)
    .trim()
    .toLowerCase();
  return domains.includes(domain) ? null : domain;
}
