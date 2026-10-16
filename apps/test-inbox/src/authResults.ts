/** One DKIM signature's verdict, with the signing domain (`header.d`). */
export interface DkimVerdict {
  result: string;
  domain: string | null;
}

/** What the receiving server concluded about a message. */
export interface AuthVerdicts {
  dkim: DkimVerdict[];
  spf: string | null;
  dmarc: string | null;
}

/**
 * Reads the verdicts out of an `Authentication-Results` header (RFC 8601), or the
 * `ARC-Authentication-Results` that Cloudflare Email Routing adds, e.g.
 * `i=1; mx.cloudflare.net; dkim=pass header.d=piccoloetterem.hu header.s=x; spf=pass …; dmarc=pass …`.
 * A message signed twice (SES signs with the sender's domain and with amazonses.com) has two DKIM
 * verdicts.
 */
export function parseAuthenticationResults(header: string): AuthVerdicts {
  const verdicts: AuthVerdicts = { dkim: [], spf: null, dmarc: null };
  for (const clause of header.split(';')) {
    const match = /^\s*(dkim|spf|dmarc)=([a-z]+)\b(.*)$/is.exec(clause);
    if (!match) continue;
    const [, method = '', result = '', rest = ''] = match;
    switch (method.toLowerCase()) {
      case 'dkim': {
        const domain =
          /\bheader\.d=([^\s;]+)/i.exec(rest)?.[1] ??
          /\bheader\.i=[^\s;@]*@([^\s;]+)/i.exec(rest)?.[1] ??
          null;
        verdicts.dkim.push({ result: result.toLowerCase(), domain: domain?.toLowerCase() ?? null });
        break;
      }
      case 'spf':
        // Cloudflare checks the HELO name and the envelope sender separately; the sender counts.
        if (verdicts.spf === null || /\bsmtp\.mailfrom=/i.test(rest)) {
          verdicts.spf = result.toLowerCase();
        }
        break;
      case 'dmarc':
        verdicts.dmarc ??= result.toLowerCase();
        break;
    }
  }
  return verdicts;
}
