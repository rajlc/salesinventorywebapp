'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getFiscalYears,
    getActiveFiscalYear,
    createFiscalYear,
    updateFiscalYear,
    deleteFiscalYear,
} from '../actions/settingsActions'

export function useFiscalYears() {
    return useQuery({
        queryKey: ['fiscal-years'],
        queryFn: async () => {
            const result = await getFiscalYears()
            if (result.error) throw new Error(result.error)
            return result.data || []
        },
        staleTime: 1000 * 60 * 10,
    })
}

export function useActiveFiscalYear() {
    return useQuery({
        queryKey: ['fiscal-year', 'active'],
        queryFn: async () => {
            const result = await getActiveFiscalYear()
            if (result.error) throw new Error(result.error)
            return result.data || null
        },
        staleTime: 1000 * 60 * 10,
    })
}

export function useCreateFiscalYear() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: createFiscalYear,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
            queryClient.invalidateQueries({ queryKey: ['fiscal-year', 'active'] })
        },
    })
}

export function useUpdateFiscalYear() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            updateFiscalYear(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
            queryClient.invalidateQueries({ queryKey: ['fiscal-year', 'active'] })
        },
    })
}

export function useDeleteFiscalYear() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: deleteFiscalYear,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['fiscal-years'] })
            queryClient.invalidateQueries({ queryKey: ['fiscal-year', 'active'] })
        },
    })
}
