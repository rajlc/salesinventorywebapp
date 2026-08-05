'use client'

import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Card, CardContent } from "@/components/ui-shim"
import StaffList from "@/features/staff-management/components/StaffList"

export default function StaffManagementPage() {
    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Staff Management"
                subtitle="Manage staff access, roles, and permissions"
            />

            <Card>
                <CardContent className="p-0">
                    <StaffList />
                </CardContent>
            </Card>
        </div>
    )
}
