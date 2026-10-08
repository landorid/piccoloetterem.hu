import { ApiError } from '@piccolo/api-client';
import { strings } from './strings';

/** A request that never reached the API: offline, DNS, or blocked by CORS. */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('The API could not be reached', options);
    this.name = 'NetworkError';
  }
}

/** A 401 from the API: the Clerk session is missing, expired or rejected. */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

type KnownCode = keyof typeof strings.errors.byCode;

function isKnownCode(code: string): code is KnownCode {
  return Object.hasOwn(strings.errors.byCode, code);
}

/** What the error toast shows: a Hungarian message, and the code staff can report. */
export function describeError(error: unknown): { code: string; message: string } {
  let code = 'unknown';
  if (error instanceof ApiError) {
    code = error.code;
  } else if (error instanceof NetworkError) {
    code = 'network';
  }
  return {
    code,
    message: isKnownCode(code) ? strings.errors.byCode[code] : strings.errors.fallback,
  };
}
