import { QueryClient } from '@tanstack/react-query';

/**
 * Shared TanStack Query client.
 *
 *   • staleTime 30 s — keeps dashboards smooth without hammering the API.
 *   • One retry on transient failures (network blips); mutations never retry.
 *   • refetchOnWindowFocus disabled — Arabic shoppers swap apps frequently.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
