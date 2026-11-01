import {
  type Breadcrumb,
  BrowserClient,
  type BrowserOptions,
  breadcrumbsIntegration,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  type ErrorEvent,
  getCurrentScope,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
} from '@sentry/react';
import { ApiError } from './api';

type SentryEnv = Pick<ImportMetaEnv, 'PUBLIC_SENTRY_DSN' | 'PUBLIC_ENVIRONMENT'>;

/**
 * Starts browser error reporting: unhandled errors and rejections, plus what `reportSubmitFailure`
 * and the island's error boundary send. Off without a DSN, as in the API. Errors only: no
 * tracing, no session replay, and nothing the guest typed (see `scrubEvent`).
 *
 * A `BrowserClient` with named integrations rather than `init`: the default set adds release
 * health sessions and browser API wrapping, about 4 KB gzipped we have no use for.
 */
export function initSentry(
  env: SentryEnv = import.meta.env,
  transport: BrowserOptions['transport'] = makeFetchTransport,
): boolean {
  if (!env.PUBLIC_SENTRY_DSN) return false;
  const client = new BrowserClient({
    dsn: env.PUBLIC_SENTRY_DSN,
    environment: env.PUBLIC_ENVIRONMENT ?? 'development',
    sendDefaultPii: false,
    transport,
    stackParser: defaultStackParser,
    integrations: [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
      breadcrumbsIntegration(),
    ],
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
  getCurrentScope().setClient(client);
  client.init();
  return true;
}

/** A submission that ended in the "submit failed" banner: a network error or an unexpected answer. */
export function reportSubmitFailure(error: unknown) {
  captureException(error, {
    tags: {
      action: 'order.submit',
      ...(error instanceof ApiError && { 'api.status': error.status, 'api.code': error.code }),
    },
  });
}

/**
 * The guest's name, phone, e-mail and address only ever travel in request bodies and form
 * fields. The SDK sends neither by default; this drops them should an integration add them.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb).filter((crumb) => crumb !== null);
  return event;
}

const bodyKeys = ['body', 'request_body', 'response_body', 'value'];

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const data = breadcrumb.data;
  if (!data || !bodyKeys.some((key) => key in data)) return breadcrumb;
  return {
    ...breadcrumb,
    data: Object.fromEntries(Object.entries(data).filter(([key]) => !bodyKeys.includes(key))),
  };
}
