'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getOnlineStores,
    createOnlineStore,
    updateOnlineStore,
    updateOnlineStoreSyncMode,
    deleteOnlineStore,
    getRetailStores,
    createRetailStore,
    updateRetailStore,
    deleteRetailStore,
} from '../actions/settingsActions'

// Online Stores Hooks
export function useOnlineStores(options?: { onlyOrderSync?: boolean; onlyChatReview?: boolean }) {
    return useQuery({
        queryKey: ['online-stores', options?.onlyOrderSync ? 'order-sync-only' : 'all', options?.onlyChatReview ? 'chat-review-only' : 'all'],
        queryFn: async () => {
            const result = await getOnlineStores(options)
            if (result.error) throw new Error(result.error)
            return result.data || []
        },
        staleTime: 1000 * 60 * 5,
    })
}

export function useCreateOnlineStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: createOnlineStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['online-stores'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-seller-accounts'] })
        },
    })
}

export function useUpdateOnlineStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            updateOnlineStore(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['online-stores'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-seller-accounts'] })
        },
    })
}

export function useToggleOnlineStoreSyncMode() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, mode }: { id: string; mode: { order_sync_enabled?: boolean; chat_review_enabled?: boolean } }) =>
            updateOnlineStoreSyncMode(id, mode),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['online-stores'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-seller-accounts'] })
        },
    })
}

export function useDeleteOnlineStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: deleteOnlineStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['online-stores'] })
            queryClient.invalidateQueries({ queryKey: ['daraz-seller-accounts'] })
        },
    })
}

// Retail Stores Hooks
export function useRetailStores() {
    return useQuery({
        queryKey: ['retail-stores'],
        queryFn: async () => {
            const result = await getRetailStores()
            if (result.error) throw new Error(result.error)
            return result.data || []
        },
        staleTime: 1000 * 60 * 10,
    })
}

export function useCreateRetailStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: createRetailStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['retail-stores'] })
        },
    })
}

export function useUpdateRetailStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            updateRetailStore(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['retail-stores'] })
        },
    })
}

export function useDeleteRetailStore() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: deleteRetailStore,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['retail-stores'] })
        },
    })
}
