'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { getMyPermissions } from '@/features/profile/actions/profile-actions'

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
    isMounted: boolean
    hasPermission: (mainRole: string, subRole?: string) => boolean
    canEdit: (mainRole: string, subRole?: string) => boolean
}

const PermissionContext = createContext<PermissionContextType>({
    userRole: null,
    permissions: [],
    isLoading: true,
    isMounted: false,
    hasPermission: () => false,
    canEdit: () => false
})

const CACHE_ROLE_KEY = 'bagmati_user_role_cache'
const CACHE_PERMS_KEY = 'bagmati_user_perms_cache'
const CACHE_USER_KEY = 'bagmati_user_id_cache'

export function PermissionProvider({ children }: { children: ReactNode }) {
    const [isMounted, setIsMounted] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [cachedRole, setCachedRole] = useState<UserRole>(null)
    const [cachedPermissions, setCachedPermissions] = useState<UserPermission[]>([])

    // 0ms instant local cache hydration on mount (prevents SSR hydration mismatch!)
    useEffect(() => {
        setIsMounted(true)
        if (typeof window !== 'undefined') {
            try {
                const uid = localStorage.getItem(CACHE_USER_KEY)
                const role = (localStorage.getItem(CACHE_ROLE_KEY) as UserRole) || null
                const raw = localStorage.getItem(CACHE_PERMS_KEY)
                const perms = raw ? JSON.parse(raw) : []

                if (uid) setUserId(uid)
                if (role) setCachedRole(role)
                if (perms.length > 0) setCachedPermissions(perms)
            } catch (err) {
                console.error('Failed to read permission cache', err)
            }
        }
    }, [])

    // 1. Get current authenticated user
    useEffect(() => {
        const getUser = async () => {
            // Check memory/storage session first in 0ms
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUserId(session.user.id)
                if (typeof window !== 'undefined') {
                    localStorage.setItem(CACHE_USER_KEY, session.user.id)
                }
                return
            }
            // Fallback only if no local session exists
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
                if (typeof window !== 'undefined') {
                    localStorage.setItem(CACHE_USER_KEY, user.id)
                }
            }
        }
        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const uid = session?.user?.id || null
            setUserId(uid)
            if (typeof window !== 'undefined') {
                if (uid) {
                    localStorage.setItem(CACHE_USER_KEY, uid)
                } else {
                    localStorage.removeItem(CACHE_ROLE_KEY)
                    localStorage.removeItem(CACHE_PERMS_KEY)
                    localStorage.removeItem(CACHE_USER_KEY)
                    setCachedRole(null)
                    setCachedPermissions([])
                }
            }
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
        staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
        refetchOnWindowFocus: false,
    })

    const role = (userProfile?.role as UserRole) || null

    // Sync role to localStorage cache
    useEffect(() => {
        if (role && typeof window !== 'undefined') {
            try {
                localStorage.setItem(CACHE_ROLE_KEY, role)
            } catch (e) {
                console.error('Failed to cache role', e)
            }
        }
    }, [role])

    const effectiveRole = role || cachedRole

    // 3. Fetch User Permissions (if restricted) via secure server action
    const { data: rawPermissions, isLoading: isPermissionsLoading } = useQuery({
        queryKey: ['user-permissions-context', userId],
        queryFn: async () => {
            if (!userId) return []
            const data = await getMyPermissions()
            return data
        },
        // Fetch permissions for any non-admin user. Also fetch when effectiveRole is null
        // (profile row may be missing) so permissions still load correctly.
        enabled: !!userId && effectiveRole !== 'admin',
        staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
        refetchOnWindowFocus: false,
    })

    // Sync permissions to localStorage cache
    useEffect(() => {
        if (rawPermissions && typeof window !== 'undefined') {
            try {
                localStorage.setItem(CACHE_PERMS_KEY, JSON.stringify(rawPermissions))
            } catch (e) {
                console.error('Failed to cache permissions', e)
            }
        }
    }, [rawPermissions])

    const effectivePermissions: UserPermission[] = useMemo(() => {
        if (rawPermissions && Array.isArray(rawPermissions)) {
            return rawPermissions as UserPermission[]
        }
        return cachedPermissions
    }, [rawPermissions, cachedPermissions])

    // Show loading while profile or permissions are still resolving.
    // Specifically: if we have a userId and user is not admin, wait for permissions.
    const isLoading = isProfileLoading
        || (!!userId && effectiveRole !== 'admin' && isPermissionsLoading && effectivePermissions.length === 0)

    // Helpers
    const hasPermission = useCallback((mainRole: string, subRole?: string) => {
        if (effectiveRole === 'admin') return true
        
        // Editor, User, and New User all need explicit permissions in the database
        const targetMain = (mainRole || '').toLowerCase().trim()
        const targetSub = (subRole || '').toLowerCase().trim()

        return effectivePermissions.some(p => {
            const pMain = (p.main_page_role || '').toLowerCase().trim()
            const pSub = (p.sub_page_role || '').toLowerCase().trim()

            // Handle interchangeable role names (e.g., Accounts vs Finance)
            const mainMatches = pMain === targetMain || 
                (targetMain === 'accounts' && pMain === 'finance') ||
                (targetMain === 'finance' && pMain === 'accounts')

            if (!mainMatches) return false

            if (targetSub) {
                if (pSub === pMain || !pSub || pSub === 'all' || pSub === 'all pages') return true
                return pSub === targetSub
            }
            return true
        })
    }, [effectiveRole, effectivePermissions])

    const canEdit = useCallback((mainRole: string, subRole?: string) => {
        if (effectiveRole === 'admin') return true
        
        // Editor has full edit access if they have permission to the page at all
        if (effectiveRole === 'editor') {
            return hasPermission(mainRole, subRole)
        }

        // For user / new_user, they need specific 'edit' or 'all' permission type
        const targetMain = (mainRole || '').toLowerCase().trim()
        const targetSub = (subRole || '').toLowerCase().trim()

        const perm = effectivePermissions.find(p => {
            const pMain = (p.main_page_role || '').toLowerCase().trim()
            const pSub = (p.sub_page_role || '').toLowerCase().trim()

            const mainMatches = pMain === targetMain ||
                (targetMain === 'accounts' && pMain === 'finance') ||
                (targetMain === 'finance' && pMain === 'accounts')

            if (!mainMatches) return false
            if (targetSub) {
                if (pSub === pMain || !pSub || pSub === 'all' || pSub === 'all pages') return true
                return pSub === targetSub
            }
            return true
        })

        return !!perm && (perm.permission_type === 'edit' || perm.permission_type === 'all')
    }, [effectiveRole, effectivePermissions, hasPermission])

    const contextValue = useMemo(() => ({
        userRole: effectiveRole,
        permissions: effectivePermissions,
        isLoading,
        isMounted,
        hasPermission,
        canEdit
    }), [effectiveRole, effectivePermissions, isLoading, isMounted, hasPermission, canEdit])

    return (
        <PermissionContext.Provider value={contextValue}>
            {children}
        </PermissionContext.Provider>
    )
}

export function usePermissions() {
    return useContext(PermissionContext)
}
