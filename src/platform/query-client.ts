import { QueryClient } from '@tanstack/react-query';
import { NativeError } from './native-error';

/**
 * Global TanStack Query Client for LifeOS Command Center.
 * Implements architectural caching policy:
 * - Stale time: 60 seconds
 * - Cache retention: 5 minutes
 * - Refetch on window focus: disabled to prevent waterfall jank
 * - Automatic retry bounded strictly to retryable network/database errors
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error instanceof NativeError) {
          return error.retryable && failureCount < 3;
        }
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(200 * 2 ** attempt, 1000),
    },
    mutations: {
      retry: false,
    },
  },
});

/** Invalidates all active queries across the application shell */
export function invalidateAllQueries(): void {
  void queryClient.invalidateQueries();
}

/** Resets all queries to initial empty state */
export function resetQueries(): void {
  queryClient.clear();
}

// Window visibility listener: refresh queries when application window regains visibility
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      invalidateAllQueries();
    }
  });
}
