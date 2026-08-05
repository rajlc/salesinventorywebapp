'use client'

import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Card, CardContent } from "@/components/ui-shim"
import UserList from "@/features/user-management/components/UserList"

export default function UserManagementPage() {
    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="User Management"
                subtitle="Manage user access, roles, and permissions"
            />

            <Card>
                <CardContent className="p-0">
                    <UserList />
                </CardContent>
            </Card>
        </div>
    )
}
