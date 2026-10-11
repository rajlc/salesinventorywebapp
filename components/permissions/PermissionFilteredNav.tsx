'use client'

import React, { ReactNode } from 'react'
import { usePermissions } from '@/lib/permissions/PermissionContext'

interface PermissionFilteredNavProps {
    mainRole: string
    subRole?: string
    children: ReactNode
}

export function PermissionFilteredNav({ mainRole, subRole, children }: PermissionFilteredNavProps) {
    const { hasPermission, isLoading, isMounted } = usePermissions()

    if (!isMounted || isLoading) {
        return null
    }

    if (!hasPermission(mainRole, subRole)) {
        return null
    }

    return <>{children}</>
}
