// @vitest-environment jsdom
import { createTransport, getClient } from '@sentry/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initSentry } from '../lib/sentry';
import { strings } from '../strings';
import { openMenu, publicConfig } from '../test/fixtures';
import { OrderingApp } from './OrderingApp';

vi.mock('./OrderScreen', () => ({
  OrderScreen: () => {
    throw new Error('the order screen crashed');
  },
}));

const dsn = 'https://public@o0.ingest.sentry.io/1';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/api/menu')
        ? Response.json(openMenu)
        : new Response(null, { status: 200 }),
    ),
  );
  // React logs every error a boundary catches.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderOrderPage = () => render(<OrderingApp initial={{ config: publicConfig }} />);

describe('a render crash in the ordering island', () => {
  it('stays off without a DSN, and still shows the message with the phone number', async () => {
    expect(initSentry({})).toBe(false);
    expect(getClient()).toBeUndefined();

    renderOrderPage();
    expect(await screen.findByRole('heading', { name: strings.errors.crashTitle })).toBeTruthy();
    expect(screen.getByText(strings.errors.crashBody)).toBeTruthy();
    expect(screen.getByRole('link', { name: publicConfig.contact.phone })).toBeTruthy();
    expect(screen.getByRole('button', { name: strings.errors.reload })).toBeTruthy();
  });

  it('sends one error event to Sentry once a DSN is set', async () => {
    // The envelopes as the fetch transport would POST them.
    const sent: string[] = [];
    const transport = (options: Parameters<typeof createTransport>[0]) =>
      createTransport(options, async ({ body }) => {
        sent.push(typeof body === 'string' ? body : new TextDecoder().decode(body));
        return { statusCode: 200 };
      });
    expect(
      initSentry({ PUBLIC_SENTRY_DSN: dsn, PUBLIC_ENVIRONMENT: 'production' }, transport),
    ).toBe(true);

    renderOrderPage();
    await screen.findByRole('heading', { name: strings.errors.crashTitle });
    await waitFor(() => expect(sent).toHaveLength(1));

    const [, item, payload] = (sent[0] ?? '').split('\n');
    expect(JSON.parse(item ?? '')).toMatchObject({ type: 'event' });
    const event = JSON.parse(payload ?? '');
    expect(event.environment).toBe('production');
    expect(event.exception.values.at(-1).value).toBe('the order screen crashed');
    expect(event.user?.ip_address).toBeUndefined();
  });
});
