import { ApiError } from '@piccolo/api-client';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { describeError, isUnauthenticated } from './errors';
import { strings } from './strings';

/**
 * The admin's `QueryClient`. Every failed query and mutation lands in one handler: a 401 calls
 * `onUnauthenticated`, anything else shows an error toast with a Hungarian message and the
 * error code. A 4xx is not retried, because asking again gets the same answer.
 */
export function createQueryClient(handlers: { onUnauthenticated: () => void }): QueryClient {
  const onError = (error: unknown) => {
    if (isUnauthenticated(error)) {
      handlers.onUnauthenticated();
      return;
    }
    const { code, message } = describeError(error);
    // One toast per code: a poll that keeps failing updates it instead of stacking new ones.
    toast.error(message, {
      id: `error-${code}`,
      description: `${strings.errors.codeLabel}: ${code}`,
    });
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 3,
      },
    },
  });
}
