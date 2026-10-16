import { type AuthVerdicts, parseAuthenticationResults } from './authResults';

const prefix = 'messages/';
const suffix = '.eml';

/**
 * A stored message's id is its key without `messages/` and `.eml`: `<to>/<received ISO>-<uuid>`.
 * Listing `messages/<to>/` therefore finds one address's messages in arrival order.
 */
export function messageKey(to: string, receivedAt: Date, uuid: string): string {
  return `${prefix}${addressPrefix(to)}${receivedAt.toISOString()}-${uuid}${suffix}`;
}

export function addressPrefix(to: string): string {
  return `${to.trim().toLowerCase()}/`;
}

export function keyOfId(id: string): string {
  return `${prefix}${id}${suffix}`;
}

export function idOfKey(key: string): string {
  return key.slice(prefix.length, -suffix.length);
}

export function listPrefix(to: string): string {
  return `${prefix}${addressPrefix(to)}`;
}

/** What the inbox keeps next to each raw message, and what the read endpoint returns. */
export interface MessageMeta extends AuthVerdicts {
  id: string;
  to: string;
  from: string;
  subject: string;
  /** The message's own `Date` header. */
  date: string;
  receivedAt: string;
  /** The header the verdicts were read from, verbatim. */
  authenticationResults: string;
}

// R2 caps custom metadata at 2 KB in total.
const maxHeaderLength = 1200;

export function toCustomMetadata(meta: MessageMeta): Record<string, string> {
  return {
    to: meta.to,
    from: meta.from,
    subject: meta.subject,
    date: meta.date,
    receivedAt: meta.receivedAt,
    authenticationResults: meta.authenticationResults.slice(0, maxHeaderLength),
  };
}

export function fromCustomMetadata(key: string, metadata: Record<string, string>): MessageMeta {
  const authenticationResults = metadata.authenticationResults ?? '';
  return {
    id: idOfKey(key),
    to: metadata.to ?? '',
    from: metadata.from ?? '',
    subject: metadata.subject ?? '',
    date: metadata.date ?? '',
    receivedAt: metadata.receivedAt ?? '',
    authenticationResults,
    ...parseAuthenticationResults(authenticationResults),
  };
}
