'use client'

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { getMyRoleAndPermissions } from '@/features/profile/actions/profile-actions'

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

    // 0ms instant local cache hydration on mount (prevents SSR hydration mismatch & keeps sidebar intact on refresh!)
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
                if (Array.isArray(perms) && perms.length > 0) setCachedPermissions(perms)
            } catch (err) {
                console.error('Failed to read permission cache', err)
            }
        }
    }, [])

    // 1. Listen for auth state changes — ONLY clear cache on explicit SIGNED_OUT (never on INITIAL_SESSION or transient timeouts)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            const uid = session?.user?.id || null
            if (uid) {
                setUserId(uid)
                if (typeof window !== 'undefined') {
                    try { localStorage.setItem(CACHE_USER_KEY, uid) } catch {}
                }
            } else if (event === 'SIGNED_OUT') {
                setUserId(null)
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.removeItem(CACHE_ROLE_KEY)
                        localStorage.removeItem(CACHE_PERMS_KEY)
                        localStorage.removeItem(CACHE_USER_KEY)
                    } catch {}
                }
                setCachedRole(null)
                setCachedPermissions([])
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // 2. Single unified Server Action query for Role + Permissions (0ms cookie JWT decode on server)
    const { data: authContextData, isLoading: isQueryLoading } = useQuery({
        queryKey: ['user-role-and-permissions', userId || 'current'],
        queryFn: async () => {
            const res = await getMyRoleAndPermissions()
            return res
        },
        staleTime: 10 * 60 * 1000, // Cache for 10 minutes
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 2,
    })

    const role = (authContextData?.role as UserRole) || null

    // Sync userId, role & permissions to localStorage cache when resolved
    useEffect(() => {
        if (!authContextData || typeof window === 'undefined') return
        try {
            if (authContextData.userId) {
                setUserId(authContextData.userId)
                localStorage.setItem(CACHE_USER_KEY, authContextData.userId)
            }
            if (authContextData.role) {
                setCachedRole(authContextData.role as UserRole)
                localStorage.setItem(CACHE_ROLE_KEY, authContextData.role)
            }
            if (Array.isArray(authContextData.permissions)) {
                setCachedPermissions(authContextData.permissions as UserPermission[])
                localStorage.setItem(CACHE_PERMS_KEY, JSON.stringify(authContextData.permissions))
            }
        } catch (e) {
            console.error('Failed to cache role/permissions', e)
        }
    }, [authContextData])

    const effectiveRole = role || cachedRole

    const effectivePermissions: UserPermission[] = useMemo(() => {
        if (authContextData?.permissions && Array.isArray(authContextData.permissions) && authContextData.permissions.length > 0) {
            return authContextData.permissions as UserPermission[]
        }
        return cachedPermissions
    }, [authContextData?.permissions, cachedPermissions])

    // Only report loading if we have neither cached role nor resolved server role yet
    const isLoading = !effectiveRole && isQueryLoading

    // Helpers
    const hasPermission = useCallback((mainRole: string, subRole?: string) => {
        if (effectiveRole === 'admin') return true

        const targetMain = (mainRole || '').toLowerCase().trim()
        const targetSub = (subRole || '').toLowerCase().trim()

        return effectivePermissions.some(p => {
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
    }, [effectiveRole, effectivePermissions])

    const canEdit = useCallback((mainRole: string, subRole?: string) => {
        if (effectiveRole === 'admin') return true

        if (effectiveRole === 'editor') {
            return hasPermission(mainRole, subRole)
        }

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
