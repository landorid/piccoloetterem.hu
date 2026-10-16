import { describe, expect, it } from 'vitest';
import { disallowedRecipientDomain } from './allowlist';

describe('disallowedRecipientDomain', () => {
  it('allows everyone when the list is unset or empty', () => {
    expect(disallowedRecipientDomain('guest@example.com', undefined)).toBeNull();
    expect(disallowedRecipientDomain('guest@example.com', ' , ')).toBeNull();
  });

  it('allows a listed domain whatever its case', () => {
    const allowed = 'inbox.piccoloetterem.hu, other.test';
    expect(disallowedRecipientDomain('run-1@Inbox.Piccoloetterem.hu', allowed)).toBeNull();
    expect(disallowedRecipientDomain('a@other.test', allowed)).toBeNull();
  });

  it('names the domain it refuses, subdomains and parents included', () => {
    const allowed = 'inbox.piccoloetterem.hu';
    expect(disallowedRecipientDomain('verify@example.com', allowed)).toBe('example.com');
    expect(disallowedRecipientDomain('info@piccoloetterem.hu', allowed)).toBe('piccoloetterem.hu');
    expect(disallowedRecipientDomain('x@a.inbox.piccoloetterem.hu', allowed)).toBe(
      'a.inbox.piccoloetterem.hu',
    );
  });
});
