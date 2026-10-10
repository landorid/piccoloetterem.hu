import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Email, mailbox, sendEmail } from './ses';

const email: Email = {
  from: { name: 'Piccolo Club Étterem', address: 'rendeles@piccoloetterem.hu' },
  replyTo: 'info@piccoloetterem.hu',
  to: 'kiss.anna@example.com',
  subject: 'Rendelését rögzítettük – 2026/41. hét (10.05 – 10.10)',
  html: '<p>Kedves Kiss Anna!</p>',
  text: 'Kedves Kiss Anna!',
};

const credentials = {
  SES_REGION: 'eu-central-1',
  SES_ACCESS_KEY_ID: 'AKIDEXAMPLE',
  SES_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
};

/** Stubs `fetch` with `answer` and records every request it gets. */
function stubFetch(answer: () => Response): Request[] {
  const requests: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      requests.push(request);
      return answer();
    }),
  );
  return requests;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sendEmail', () => {
  it('posts a signed SES v2 SendEmail and returns its MessageId', async () => {
    const requests = stubFetch(() => Response.json({ MessageId: 'ses-message-1' }));

    await expect(sendEmail(credentials, email)).resolves.toEqual({
      dryRun: false,
      messageId: 'ses-message-1',
    });

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('https://email.eu-central-1.amazonaws.com/v2/email/outbound-emails');
    expect(request?.headers.get('authorization')).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/eu-central-1\/ses\/aws4_request, SignedHeaders=[^,]+, Signature=[0-9a-f]{64}$/,
    );
    expect(await request?.json()).toEqual({
      FromEmailAddress: '=?UTF-8?B?UGljY29sbyBDbHViIMOJdHRlcmVt?= <rendeles@piccoloetterem.hu>',
      Destination: { ToAddresses: ['kiss.anna@example.com'] },
      ReplyToAddresses: ['info@piccoloetterem.hu'],
      Content: {
        Simple: {
          Subject: {
            Data: 'Rendelését rögzítettük – 2026/41. hét (10.05 – 10.10)',
            Charset: 'UTF-8',
          },
          Body: {
            Html: { Data: '<p>Kedves Kiss Anna!</p>', Charset: 'UTF-8' },
            Text: { Data: 'Kedves Kiss Anna!', Charset: 'UTF-8' },
          },
        },
      },
    });
  });

  it('logs the e-mail in dry run and sends nothing', async () => {
    const requests = stubFetch(() => Response.json({ MessageId: 'never' }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(sendEmail({ EMAIL_DRY_RUN: '1' }, email)).resolves.toEqual({ dryRun: true });

    expect(requests).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toBe(
      [
        '[email dry run]',
        'From: Piccolo Club Étterem <rendeles@piccoloetterem.hu>',
        'Reply-To: info@piccoloetterem.hu',
        'To: kiss.anna@example.com',
        'Subject: Rendelését rögzítettük – 2026/41. hét (10.05 – 10.10)',
        'HTML: 24 characters',
        '',
        'Kedves Kiss Anna!',
      ].join('\n'),
    );
  });

  it('names every missing credential and sends nothing', async () => {
    const requests = stubFetch(() => Response.json({ MessageId: 'never' }));

    await expect(sendEmail({ SES_REGION: 'eu-central-1' }, email)).rejects.toThrow(
      'SES is not configured: set SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY.',
    );
    await expect(sendEmail({ EMAIL_DRY_RUN: '0' }, email)).rejects.toThrow(
      'SES is not configured: set SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY.',
    );
    expect(requests).toEqual([]);
  });

  it('rejects with the status, the SES error type and its message', async () => {
    const requests = stubFetch(() =>
      Response.json(
        { message: 'Email address is not verified.' },
        {
          status: 400,
          headers: { 'x-amzn-ErrorType': 'MessageRejected:http://internal.amazon.com/coral/' },
        },
      ),
    );

    await expect(sendEmail(credentials, email)).rejects.toThrow(
      'SES SendEmail failed with 400 MessageRejected: Email address is not verified.',
    );
    expect(requests).toHaveLength(1);
  });

  it('retries a 5xx twice, then rejects', async () => {
    const requests = stubFetch(() => new Response('', { status: 503 }));

    await expect(sendEmail(credentials, email)).rejects.toThrow(
      'SES SendEmail failed with 503 UnknownError',
    );
    expect(requests).toHaveLength(3);
  });
});

describe('mailbox', () => {
  it('leaves a plain ASCII name as it is', () => {
    expect(mailbox('Piccolo', 'a@example.com')).toBe('Piccolo <a@example.com>');
  });

  it('quotes an ASCII name with a special character', () => {
    expect(mailbox('Piccolo, Szombathely "Club"', 'a@example.com')).toBe(
      '"Piccolo, Szombathely \\"Club\\"" <a@example.com>',
    );
  });

  it('splits a long non-ASCII name into encoded-words of at most 75 characters', () => {
    const name = 'Piccolo Club Étterem és Kávéház, Szombathely, Mátyás király utca';
    const header = mailbox(name, 'a@example.com');
    const words = header.replace(/ <a@example\.com>$/, '').split(' ');

    expect(words.length).toBeGreaterThan(1);
    for (const word of words) {
      expect(word).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
      expect(word.length).toBeLessThanOrEqual(75);
    }
    const decoded = words
      .map((word) => Buffer.from(word.slice(10, -2), 'base64').toString('utf8'))
      .join('');
    expect(decoded).toBe(name);
  });
});
