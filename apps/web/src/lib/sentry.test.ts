import type { ErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubEvent } from './sentry';

describe('scrubEvent', () => {
  it('drops request bodies and cookies, and body fields from breadcrumbs', () => {
    const event = scrubEvent({
      type: undefined,
      request: {
        url: 'https://piccoloetterem.hu/megrendeles',
        data: '{"name":"Kiss Anna","phone":"+36301234567"}',
        cookies: { session: 'x' },
      },
      breadcrumbs: [
        { category: 'fetch', data: { url: '/api/orders', method: 'POST', body: '{"name":"x"}' } },
        { category: 'ui.input', message: 'input[name="email"]', data: { value: 'a@b.hu' } },
        { category: 'navigation' },
      ],
    } as ErrorEvent);

    expect(event.request).toEqual({ url: 'https://piccoloetterem.hu/megrendeles' });
    expect(event.breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/api/orders', method: 'POST' } },
      { category: 'ui.input', message: 'input[name="email"]', data: {} },
      { category: 'navigation' },
    ]);
  });

  it('leaves a breadcrumb without a body as it was', () => {
    const crumb = { category: 'fetch', data: { url: '/api/menu', status_code: 200 } };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});
