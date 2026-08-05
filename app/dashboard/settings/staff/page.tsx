'use client'

import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"

export default function StaffPage() {
    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Staff Management"
                subtitle="Manage staff members and their permissions"
            />

            <Card>
                <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Coming soon...</p>
                </CardContent>
            </Card>
        </div>
    )
}
