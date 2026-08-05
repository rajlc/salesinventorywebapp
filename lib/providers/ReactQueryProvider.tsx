"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = React.useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000, // 30 seconds - fresh data more frequently
                gcTime: 5 * 60 * 1000, // 5 minutes - clean up unused data faster
                refetchOnWindowFocus: false, // Don't refetch on window focus
                retry: 1, // Only retry once on failure
                refetchOnReconnect: false, // Don't refetch on reconnect
                structuralSharing: true, // Enable structural sharing for better performance
            },
        },
    }))

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
