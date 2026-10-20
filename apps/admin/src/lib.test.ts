import { ApiError } from '@piccolo/api-client';
import { describe, expect, it } from 'vitest';
import { formatDateLong, fromIsoDate, toIsoDate } from '@/dates';
import { describeError, isUnauthenticated, NetworkError } from '@/errors';
import { loginPath, paths } from '@/paths';
import { createQueryClient } from '@/queryClient';
import { strings } from '@/strings';

describe('describeError', () => {
  it('maps a known API code to its Hungarian message', () => {
    expect(describeError(new ApiError(403, 'forbidden', 'Forbidden'))).toEqual({
      code: 'forbidden',
      message: strings.errors.byCode.forbidden,
    });
    expect(describeError(new ApiError(500, 'internal', 'Internal Server Error'))).toEqual({
      code: 'internal',
      message: strings.errors.byCode.internal,
    });
  });

  it('keeps an unknown API code with the fallback message', () => {
    expect(describeError(new ApiError(404, 'week_not_found', 'No week'))).toEqual({
      code: 'week_not_found',
      message: strings.errors.fallback,
    });
  });

  it('reports a request that never arrived as network', () => {
    expect(describeError(new NetworkError())).toEqual({
      code: 'network',
      message: strings.errors.byCode.network,
    });
  });

  it('does not take a bug in the caller for a network error', () => {
    expect(describeError(new TypeError('x is undefined'))).toEqual({
      code: 'unknown',
      message: strings.errors.fallback,
    });
  });

  it('does not let an inherited property pose as a code', () => {
    expect(describeError(new ApiError(400, 'toString', 'x')).message).toBe(strings.errors.fallback);
  });
});

describe('isUnauthenticated', () => {
  it('is true for a 401 only', () => {
    expect(isUnauthenticated(new ApiError(401, 'unauthenticated', 'x'))).toBe(true);
    expect(isUnauthenticated(new ApiError(403, 'forbidden', 'x'))).toBe(false);
    expect(isUnauthenticated(new Error('x'))).toBe(false);
  });
});

describe('createQueryClient retry', () => {
  const retry = createQueryClient({ onUnauthenticated: () => {} }).getDefaultOptions().queries
    ?.retry as (failureCount: number, error: unknown) => boolean;

  it('never retries a 4xx', () => {
    expect(retry(0, new ApiError(401, 'unauthenticated', 'x'))).toBe(false);
    expect(retry(0, new ApiError(404, 'not_found', 'x'))).toBe(false);
  });

  it('retries a 5xx or a network error up to three times', () => {
    expect(retry(0, new ApiError(503, 'unknown', 'x'))).toBe(true);
    expect(retry(2, new NetworkError())).toBe(true);
    expect(retry(3, new NetworkError())).toBe(false);
  });
});

describe('loginPath', () => {
  it('returns to the given page, query and hash included', () => {
    const path = loginPath(
      { pathname: '/heti-menu', search: '?week=41', hash: '#kedd' },
      'https://admin.example.hu',
    );
    const url = new URL(path, 'https://admin.example.hu');
    expect(url.pathname).toBe(paths.login);
    expect(url.searchParams.get('redirect_url')).toBe(
      'https://admin.example.hu/heti-menu?week=41#kedd',
    );
  });
});

describe('dates', () => {
  it('converts between local days and ISO dates without a UTC shift', () => {
    expect(toIsoDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(toIsoDate(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31');
    expect(fromIsoDate('2026-10-08')?.getTime()).toBe(new Date(2026, 9, 8).getTime());
  });

  it('rejects what is not an ISO date', () => {
    expect(fromIsoDate('2026-13-01')).toBeUndefined();
    expect(fromIsoDate('nope')).toBeUndefined();
  });

  it('formats a Hungarian long date with the weekday', () => {
    expect(formatDateLong(new Date(2026, 9, 8))).toBe('2026. október 8., csütörtök');
  });
});
