import PostalMime from 'postal-mime';
import { parseAuthenticationResults } from './authResults';
import {
  fromCustomMetadata,
  keyOfId,
  listPrefix,
  type MessageMeta,
  messageKey,
  toCustomMetadata,
} from './store';

/**
 * The test inbox: Cloudflare Email Routing delivers every address on `inbox.piccoloetterem.hu`
 * here, the `email` handler keeps the message in R2 for a day (the bucket's lifecycle rule), and
 * the `fetch` handler lets an agent with `INBOX_TOKEN` read it back. Test tooling for the verify
 * skill, not part of the product; see README.md.
 */
export interface Env {
  MESSAGES: R2Bucket;
  INBOX_TOKEN?: string;
  /**
   * The only domain accepted. Email Routing's catch-all covers the whole zone; the apex's MX points
   * elsewhere today, and this keeps it that way should mail for it ever arrive here.
   */
  INBOX_DOMAIN: string;
}

const maxMessageSize = 1024 * 1024;

export default {
  async email(message, env) {
    if (!message.to.toLowerCase().endsWith(`@${env.INBOX_DOMAIN}`)) {
      message.setReject(`Only ${env.INBOX_DOMAIN} is a test inbox`);
      return;
    }
    if (message.rawSize > maxMessageSize) {
      message.setReject('Message too large for the test inbox');
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const receivedAt = new Date();
    const authenticationResults =
      message.headers.get('authentication-results') ??
      message.headers.get('arc-authentication-results') ??
      '';
    const meta: MessageMeta = {
      id: '',
      to: message.to.toLowerCase(),
      from: parsed.from?.address ?? message.from,
      subject: parsed.subject ?? '',
      date: parsed.date ?? '',
      receivedAt: receivedAt.toISOString(),
      authenticationResults,
      ...parseAuthenticationResults(authenticationResults),
    };
    await env.MESSAGES.put(messageKey(message.to, receivedAt, crypto.randomUUID()), raw, {
      httpMetadata: { contentType: 'message/rfc822' },
      customMetadata: toCustomMetadata(meta),
    });
  },

  async fetch(request, env) {
    if (!(await authorized(request, env.INBOX_TOKEN))) {
      return json({ error: 'unauthorized' }, 401);
    }
    if (request.method !== 'GET') {
      return json({ error: 'method not allowed' }, 405);
    }
    const url = new URL(request.url);
    if (url.pathname === '/messages') {
      const to = url.searchParams.get('to');
      if (!to) return json({ error: 'missing ?to=<address>' }, 400);
      return json({ messages: await listMessages(env.MESSAGES, to) });
    }
    const match = /^\/messages\/(.+?)(\/raw)?$/.exec(url.pathname);
    if (!match?.[1]) return json({ error: 'not found' }, 404);
    const id = decodeURIComponent(match[1]);
    const object = await env.MESSAGES.get(keyOfId(id));
    if (!object) return json({ error: 'not found' }, 404);
    if (match[2]) {
      return new Response(object.body, { headers: { 'content-type': 'message/rfc822' } });
    }
    const parsed = await PostalMime.parse(await object.arrayBuffer());
    return json({
      ...fromCustomMetadata(object.key, object.customMetadata ?? {}),
      text: parsed.text ?? '',
      html: parsed.html ?? '',
    });
  },
} satisfies ExportedHandler<Env>;

/** Newest first. One page of R2's list (1000 objects) is plenty for one address in a day. */
async function listMessages(bucket: R2Bucket, to: string): Promise<MessageMeta[]> {
  const listed = await bucket.list({ prefix: listPrefix(to), include: ['customMetadata'] });
  return listed.objects
    .map((object) => fromCustomMetadata(object.key, object.customMetadata ?? {}))
    .reverse();
}

/**
 * `Authorization: Bearer <INBOX_TOKEN>`. Both sides are hashed first, so the comparison is
 * constant-time whatever their lengths. No token configured means no access.
 */
export async function authorized(request: Request, token: string | undefined): Promise<boolean> {
  const presented = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token || !presented) return false;
  const [a, b] = await Promise.all([sha256(presented), sha256(token)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
