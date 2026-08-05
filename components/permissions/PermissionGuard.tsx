'use client'

import React, { ReactNode } from 'react'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { Forbidden403 } from './Forbidden403'

interface PermissionGuardProps {
    children: ReactNode
    mainRole: string
    subRole?: string
    requireEdit?: boolean
    fallback?: ReactNode // Optional custom fallback, otherwise uses Forbidden403
}

export function PermissionGuard({ children, mainRole, subRole, requireEdit = false, fallback }: PermissionGuardProps) {
    const { isLoading, hasPermission, canEdit } = usePermissions()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-[15px] text-gray-500">Checking permissions...</p>
                </div>
            </div>
        )
    }

    const isAllowed = requireEdit ? canEdit(mainRole, subRole) : hasPermission(mainRole, subRole)

    if (!isAllowed) {
        return <>{fallback !== undefined ? fallback : <Forbidden403 />}</>
    }

    return <>{children}</>
}
