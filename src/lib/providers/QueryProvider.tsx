'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Cache for 5 minutes
                        staleTime: 5 * 60 * 1000,
                        // Keep in cache for 10 minutes
                        gcTime: 10 * 60 * 1000,
                        // Retry failed requests 3 times
                        retry: 3,
                        // Retry with exponential backoff
                        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
                        // Refetch on window focus for real-time data
                        refetchOnWindowFocus: true,
                        // Don't refetch on mount if data is fresh
                        refetchOnMount: false,
                        // Refetch on reconnect
                        refetchOnReconnect: true,
                    },
                    mutations: {
                        // Retry mutations once
                        retry: 1,
                        // Show loading states
                        onError: (error) => {
                            console.error('Mutation error:', error);
                        },
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* React Query DevTools - only in development */}
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} position="bottom" />
            )}
        </QueryClientProvider>
    );
}
