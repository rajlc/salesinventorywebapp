'use client'

import React, { ReactNode } from 'react'
import { usePermissions } from '@/lib/permissions/PermissionContext'

interface PermissionFilteredNavProps {
    mainRole: string
    subRole?: string
    children: ReactNode
}

export function PermissionFilteredNav({ mainRole, subRole, children }: PermissionFilteredNavProps) {
    const { hasPermission, isLoading } = usePermissions()

    if (isLoading) {
        // While loading permissions, hide the nav items to prevent flicker
        // Or could return a skeleton if needed. Let's just return null for now.
        return null
    }

    if (!hasPermission(mainRole, subRole)) {
        return null
    }

    return <>{children}</>
}
