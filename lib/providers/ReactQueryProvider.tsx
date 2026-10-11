"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = React.useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000, // 1 minute fresh window (avoids redundant network refetches on rapid clicks)
                gcTime: 30 * 60 * 1000, // 30 minutes cache retention (instant 0ms data display when switching back and forth)
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
