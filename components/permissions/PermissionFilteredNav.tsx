'use client'

import React, { ReactNode } from 'react'
import { usePermissions } from '@/lib/permissions/PermissionContext'

interface PermissionFilteredNavProps {
    mainRole?: string
    subRole?: string
    adminOnly?: boolean
    children: ReactNode
}

export function PermissionFilteredNav({ mainRole, subRole, adminOnly, children }: PermissionFilteredNavProps) {
    const { userRole, hasPermission, isLoading, isMounted } = usePermissions()

    if (!isMounted || isLoading) {
        return null
    }

    if (adminOnly) {
        if (userRole !== 'admin') {
            return null
        }
        return <>{children}</>
    }

    if (mainRole && !hasPermission(mainRole, subRole)) {
        return null
    }

    return <>{children}</>
}
