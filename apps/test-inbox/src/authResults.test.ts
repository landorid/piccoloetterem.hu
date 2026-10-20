import { describe, expect, it } from 'vitest';
import { parseAuthenticationResults } from './authResults';

describe('parseAuthenticationResults', () => {
  it('reads every DKIM signature and the SPF and DMARC verdicts', () => {
    const header =
      'i=1; mx.cloudflare.net; dkim=pass header.d=piccoloetterem.hu header.s=abc header.b=X1; ' +
      'dkim=pass header.d=amazonses.com header.s=def header.b=Y2; dmarc=pass header.from=piccoloetterem.hu ' +
      'policy.dmarc=none; spf=pass (mx.cloudflare.net: domain of x@eu-west-1.amazonses.com) ' +
      'smtp.mailfrom=x@eu-west-1.amazonses.com';
    expect(parseAuthenticationResults(header)).toEqual({
      dkim: [
        { result: 'pass', domain: 'piccoloetterem.hu' },
        { result: 'pass', domain: 'amazonses.com' },
      ],
      spf: 'pass',
      dmarc: 'pass',
    });
  });

  it("takes the envelope sender's SPF over the HELO check", () => {
    const header =
      'mx.cloudflare.net; spf=none (no SPF records) smtp.helo=a4-7.smtp-out.amazonses.com; ' +
      'spf=pass (designates 54.240.4.7) smtp.mailfrom=x@noreply.piccoloetterem.hu; arc=none';
    expect(parseAuthenticationResults(header).spf).toBe('pass');
  });

  it('falls back to header.i and keeps failures', () => {
    expect(parseAuthenticationResults('mx.example; dkim=FAIL header.i=@Example.org')).toEqual({
      dkim: [{ result: 'fail', domain: 'example.org' }],
      spf: null,
      dmarc: null,
    });
  });

  it('finds nothing in an empty header', () => {
    expect(parseAuthenticationResults('')).toEqual({ dkim: [], spf: null, dmarc: null });
  });
});
