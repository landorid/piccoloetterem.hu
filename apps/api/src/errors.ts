import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * An expected failure a handler reports to the client, rendered by `app.onError` as
 * `{ error: code, message }`. `code` is machine-readable and the frontends map it to Hungarian
 * copy in their own strings.ts; `message` is for developers and never shown to users.
 * Not reported to Sentry.
 */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
