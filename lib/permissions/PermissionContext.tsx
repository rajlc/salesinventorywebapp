'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export type UserRole = 'admin' | 'editor' | 'user' | 'new_user' | null

export interface UserPermission {
    id: string
    user_id: string
    main_page_role: string | null
    sub_page_role: string | null
    permission_type: 'view' | 'edit' | 'all'
}

interface PermissionContextType {
    userRole: UserRole
    permissions: UserPermission[]
    isLoading: boolean
    hasPermission: (mainRole: string, subRole?: string) => boolean
    canEdit: (mainRole: string, subRole?: string) => boolean
}

const PermissionContext = createContext<PermissionContextType>({
    userRole: null,
    permissions: [],
    isLoading: true,
    hasPermission: () => false,
    canEdit: () => false
})

export function PermissionProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState<string | null>(null)

    // 1. Get current authenticated user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
            }
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserId(session?.user?.id || null)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase.auth])

    // 2. Fetch User Profile (Role)
    const { data: userProfile, isLoading: isProfileLoading } = useQuery({
        queryKey: ['user-profile', userId],
        queryFn: async () => {
            if (!userId) return null
            const { data, error } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', userId)
                .single()
            
            if (error) throw error
            return data
        },
        enabled: !!userId,
        refetchInterval: 60000 // Poll every 60 seconds for instant updates
    })

    const role = (userProfile?.role as UserRole) || null

    // 3. Fetch User Permissions (if restricted)
    const { data: rawPermissions, isLoading: isPermissionsLoading } = useQuery({
        queryKey: ['user-permissions-context', userId],
        queryFn: async () => {
            if (!userId) return []
            const { data, error } = await supabase
                .from('user_permissions')
                .select('id, user_id, main_page_role, sub_page_role, permission_type')
                .eq('user_id', userId)
            
            if (error) throw error
            return data
        },
        enabled: !!userId && (role === 'user' || role === 'new_user' || role === 'editor'),
        refetchInterval: 60000 // Poll every 60 seconds
    })

    const permissions: UserPermission[] = (rawPermissions || []) as UserPermission[]

    const isLoading = isProfileLoading || (!!userId && isPermissionsLoading && role !== 'admin')

    // Helpers
    const hasPermission = (mainRole: string, subRole?: string) => {
        if (role === 'admin') return true
        
        // Editor, User, and New User all need explicit permissions in the database
        return permissions.some(p => {
            if (subRole) {
                return p.main_page_role === mainRole && p.sub_page_role === subRole
            }
            return p.main_page_role === mainRole
        })
    }

    const canEdit = (mainRole: string, subRole?: string) => {
        if (role === 'admin') return true
        
        // Editor has full edit access if they have permission to the page at all
        if (role === 'editor') {
            return hasPermission(mainRole, subRole)
        }

        // For user / new_user, they need specific 'edit' or 'all' permission type
        const perm = permissions.find(p => {
            if (subRole) {
                return p.main_page_role === mainRole && p.sub_page_role === subRole
            }
            return p.main_page_role === mainRole
        })

        return !!perm && (perm.permission_type === 'edit' || perm.permission_type === 'all')
    }

    return (
        <PermissionContext.Provider value={{
            userRole: role,
            permissions,
            isLoading,
            hasPermission,
            canEdit
        }}>
            {children}
        </PermissionContext.Provider>
    )
}

export function usePermissions() {
    return useContext(PermissionContext)
}
