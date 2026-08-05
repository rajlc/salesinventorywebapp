'use client'

import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import FiscalYearList from '@/features/settings/components/FiscalYearList'

export default function FiscalYearsPage() {
    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Fiscal Years"
                subtitle="Configure your fiscal year periods"
            />

            <FiscalYearList />
        </div>
    )
}
