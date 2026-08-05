'use client'

import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import RoleList from '@/features/settings/components/RoleList'
import { Shield } from 'lucide-react'

export default function RolesPage() {
    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Page Roles Reference"
                subtitle="View all available page roles and sub-roles in the system"
            />

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex gap-3">
                <Shield className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
                <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">System Roles Reference</p>
                    <p>This table displays all predefined page roles available for assignment. To assign these roles to users, navigate to the Staff Management page.</p>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <RoleList />
                </CardContent>
            </Card>
        </div>
    )
}
