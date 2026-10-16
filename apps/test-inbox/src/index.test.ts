import { describe, expect, it } from 'vitest';
import worker, { authorized, type Env } from './index';
import { idOfKey, messageKey } from './store';

const token = 'test-token';

function request(path: string, auth: string | null = `Bearer ${token}`): Request {
  return new Request(`https://inbox.example${path}`, {
    headers: auth ? { authorization: auth } : {},
  });
}

/** The two R2 calls the `fetch` handler makes, over an in-memory map. */
function fakeBucket(objects: Map<string, { raw: string; customMetadata: Record<string, string> }>) {
  return {
    async list({ prefix }: { prefix: string }) {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      return {
        objects: keys.map((key) => ({ key, customMetadata: objects.get(key)?.customMetadata })),
      };
    },
    async get(key: string) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        key,
        customMetadata: object.customMetadata,
        body: new Response(object.raw).body,
        arrayBuffer: async () => new TextEncoder().encode(object.raw).buffer,
      };
    },
  } as unknown as R2Bucket;
}

const raw = [
  'From: Piccolo <rendeles@piccoloetterem.hu>',
  'To: guest@inbox.example',
  'Subject: =?UTF-8?Q?Rendel=C3=A9s?=',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Fizetendő: 2 590 Ft',
].join('\r\n');

function env(): Env {
  const older = messageKey('Guest@Inbox.example', new Date('2026-10-16T10:00:00Z'), 'a');
  const newer = messageKey('guest@inbox.example', new Date('2026-10-16T11:00:00Z'), 'b');
  const meta = (receivedAt: string) => ({
    to: 'guest@inbox.example',
    from: 'rendeles@piccoloetterem.hu',
    subject: 'Rendelés',
    date: '',
    receivedAt,
    authenticationResults: 'mx.cloudflare.net; dkim=pass header.d=piccoloetterem.hu',
  });
  return {
    INBOX_DOMAIN: 'inbox.example',
    INBOX_TOKEN: token,
    MESSAGES: fakeBucket(
      new Map([
        [older, { raw, customMetadata: meta('2026-10-16T10:00:00.000Z') }],
        [newer, { raw, customMetadata: meta('2026-10-16T11:00:00.000Z') }],
        [messageKey('other@inbox.example', new Date(), 'c'), { raw, customMetadata: meta('') }],
      ]),
    ),
  };
}

const fetchInbox = (req: Request, e: Env = env()) =>
  worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, e);

describe('authorized', () => {
  it('accepts only the configured bearer token', async () => {
    expect(await authorized(request('/'), token)).toBe(true);
    expect(await authorized(request('/', 'Bearer wrong'), token)).toBe(false);
    expect(await authorized(request('/', token), token)).toBe(false);
    expect(await authorized(request('/', null), token)).toBe(false);
  });

  it('refuses everyone when no token is configured', async () => {
    expect(await authorized(request('/'), undefined)).toBe(false);
  });
});

describe('fetch', () => {
  it('answers 401 without the token', async () => {
    expect((await fetchInbox(request('/messages?to=guest@inbox.example', null))).status).toBe(401);
  });

  it("lists one address's messages, newest first, whatever the address's case", async () => {
    const response = await fetchInbox(request('/messages?to=GUEST@inbox.example'));
    const { messages } = (await response.json()) as { messages: { receivedAt: string }[] };
    expect(messages.map((m) => m.receivedAt)).toEqual([
      '2026-10-16T11:00:00.000Z',
      '2026-10-16T10:00:00.000Z',
    ]);
    expect(messages[0]).toMatchObject({
      dkim: [{ result: 'pass', domain: 'piccoloetterem.hu' }],
    });
  });

  it('returns one message with its decoded text, and the raw .eml', async () => {
    const id = idOfKey(messageKey('guest@inbox.example', new Date('2026-10-16T11:00:00Z'), 'b'));
    const one = await fetchInbox(request(`/messages/${encodeURIComponent(id)}`));
    expect(await one.json()).toMatchObject({ id, text: expect.stringContaining('2 590 Ft') });
    const eml = await fetchInbox(request(`/messages/${encodeURIComponent(id)}/raw`));
    expect(eml.headers.get('content-type')).toBe('message/rfc822');
    expect(await eml.text()).toBe(raw);
  });

  it('answers 400 without ?to= and 404 for an unknown id', async () => {
    expect((await fetchInbox(request('/messages'))).status).toBe(400);
    expect((await fetchInbox(request('/messages/nobody%40x/1-z'))).status).toBe(404);
  });
});
