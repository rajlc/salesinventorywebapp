'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Plus } from 'lucide-react'
import CourierList from '@/features/settings/components/CourierList'
import AddCourierDialog from '@/features/settings/components/AddCourierDialog'

export default function CouriersPage() {
    const [isAddOpen, setIsAddOpen] = useState(false)

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Courier"
                subtitle="Manage courier providers and delivery services"
            />

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={16} />
                    Add New
                </button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <CourierList />
                </CardContent>
            </Card>

            <AddCourierDialog
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
            />
        </div>
    )
}
