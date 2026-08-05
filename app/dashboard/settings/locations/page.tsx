'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui-shim'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Plus, Upload } from 'lucide-react'
import DeliveryLocationList from '@/features/settings/components/DeliveryLocationList'
import AddDeliveryLocationDialog from '@/features/settings/components/AddDeliveryLocationDialog'
import BulkUploadDialog from '@/features/settings/components/BulkUploadDialog'

export default function LocationsPage() {
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isBulkOpen, setIsBulkOpen] = useState(false)

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Courier"
                subtitle="Delivery Location & Charges by Courier Provider"
            />

            <div className="flex justify-end gap-3">
                <button
                    onClick={() => setIsBulkOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                >
                    <Upload size={16} />
                    Bulk Upload
                </button>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
                >
                    <Plus size={16} />
                    Add New Location
                </button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <DeliveryLocationList />
                </CardContent>
            </Card>

            <AddDeliveryLocationDialog
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
            />

            <BulkUploadDialog
                isOpen={isBulkOpen}
                onClose={() => setIsBulkOpen(false)}
            />
        </div>
    )
}
