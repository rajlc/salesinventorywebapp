"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface UserProfile {
    id: string
    full_name: string
    email?: string // Join from auth.users? Hard to get directly from profiles unless triggers copy it. 
    // Actually triggers DON'T copy email usually. 
    // Admin API is needed for Email usually, or we store email in profiles trigger.
    role: 'admin' | 'manager' | 'staff'
    is_active: boolean
    assigned_store_id?: string
    last_active_at?: string
    created_at: string
}

const fetchUsers = async () => {
    // In a real app, we might need a stored procedure or View to get email + profile 
    // because accessing auth.users is restricted.
    // For now, let's fetch profiles and assume we might strictly need to use "full_name".
    // Or we rely on proper RLS that allows Admin to see all profiles.

    // Note: 'email' is in auth.users. To show it, we either need a Server Function 
    // or a View. Let's start with just Profiles data.

    const { data, error } = await supabase
        .from('profiles')
        .select(`
            *,
            stores (name)
        `)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data
}

export function useUsers() {
    const queryClient = useQueryClient()

    const { data, isLoading, error } = useQuery({
        queryKey: ['admin_users'],
        queryFn: fetchUsers
    })

    const updateUserMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string, updates: Partial<UserProfile> }) => {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin_users'] })
        }
    })

    return {
        users: data,
        isLoading,
        error,
        updateUser: updateUserMutation.mutateAsync
    }
}
