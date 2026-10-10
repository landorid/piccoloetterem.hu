import { AwsClient } from 'aws4fetch';
import type { Bindings } from '../env';

/** One message, already rendered. */
export interface Email {
  from: { name: string; address: string };
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult = { dryRun: true } | { dryRun: false; messageId: string };

export type SesEnv = Pick<
  Bindings,
  'EMAIL_DRY_RUN' | 'SES_REGION' | 'SES_ACCESS_KEY_ID' | 'SES_SECRET_ACCESS_KEY'
>;

const credentialNames = ['SES_REGION', 'SES_ACCESS_KEY_ID', 'SES_SECRET_ACCESS_KEY'] as const;

/**
 * Sends `email` with SES v2 `SendEmail`, signed with SigV4 by `aws4fetch` (no AWS SDK: it does not
 * fit a Worker). `EMAIL_DRY_RUN=1` logs it instead and sends nothing. Rejects when a credential is
 * missing or SES answers with an error, so the caller can tell a sent e-mail from one that was not.
 *
 * A 5xx or 429 is retried twice, briefly: this runs inside `waitUntil`, and `aws4fetch`'s default
 * of ten retries with exponential backoff would outlive it.
 */
export async function sendEmail(env: SesEnv, email: Email): Promise<SendResult> {
  if (env.EMAIL_DRY_RUN === '1') {
    console.log(
      [
        '[email dry run]',
        `From: ${email.from.name} <${email.from.address}>`,
        `Reply-To: ${email.replyTo}`,
        `To: ${email.to}`,
        `Subject: ${email.subject}`,
        `HTML: ${email.html.length} characters`,
        '',
        email.text,
      ].join('\n'),
    );
    return { dryRun: true };
  }

  const missing = credentialNames.filter((name) => !env[name]);
  const { SES_REGION: region, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY } = env;
  if (!region || !SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
    throw new Error(`SES is not configured: set ${missing.join(', ')}.`);
  }
  const ses = new AwsClient({
    accessKeyId: SES_ACCESS_KEY_ID,
    secretAccessKey: SES_SECRET_ACCESS_KEY,
    service: 'ses',
    region,
    retries: 2,
  });
  const charset = 'UTF-8';
  const response = await ses.fetch(
    `https://email.${region}.amazonaws.com/v2/email/outbound-emails`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        FromEmailAddress: mailbox(email.from.name, email.from.address),
        Destination: { ToAddresses: [email.to] },
        ReplyToAddresses: [email.replyTo],
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: charset },
            Body: {
              Html: { Data: email.html, Charset: charset },
              Text: { Data: email.text, Charset: charset },
            },
          },
        },
      }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    MessageId?: string;
    message?: string;
    Message?: string;
  };
  if (!response.ok || !body.MessageId) {
    // REST-JSON errors name their type in this header, e.g. `MessageRejected:http://…`.
    const type = response.headers.get('x-amzn-errortype')?.split(':')[0] ?? 'UnknownError';
    const message = body.message ?? body.Message ?? response.statusText;
    throw new Error(`SES SendEmail failed with ${response.status} ${type}: ${message}`);
  }
  return { dryRun: false, messageId: body.MessageId };
}

/**
 * `Name <address>` for a header. SES takes header values as ASCII only, so a name with any other
 * character goes out as RFC 2047 encoded-words, each at most 75 characters; an ASCII name with a
 * special character is quoted.
 */
export function mailbox(name: string, address: string): string {
  if (/[^\x20-\x7e]/.test(name)) {
    return `${encodedWords(name)} <${address}>`;
  }
  if (/[()<>[\]:;@\\,."]/.test(name)) {
    return `"${name.replace(/[\\"]/g, '\\$&')}" <${address}>`;
  }
  return `${name} <${address}>`;
}

const utf8 = new TextEncoder();

/** 45 bytes are 60 base64 characters, the most that fits `=?UTF-8?B?…?=` in 75. */
const maxWordBytes = 45;

function encodedWords(text: string): string {
  const words: string[] = [];
  let word = '';
  for (const char of text) {
    if (utf8.encode(word + char).length > maxWordBytes) {
      words.push(word);
      word = '';
    }
    word += char;
  }
  words.push(word);
  return words
    .map((chunk) => `=?UTF-8?B?${btoa(String.fromCharCode(...utf8.encode(chunk)))}?=`)
    .join(' ');
}
