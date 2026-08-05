'use client'

import { useState, use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SettingsPageHeader } from "@/components/settings/SettingsPageHeader"
import { Plus, Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui-shim'
import CourierLocationList from '@/features/settings/components/CourierLocationList'
import AddCourierLocationDialog from '@/features/settings/components/AddCourierLocationDialog'
import BulkUploadCourierLocationsDialog from '@/features/settings/components/BulkUploadCourierLocationsDialog'
import { supabase } from '@/lib/supabase/client'

interface CourierDetailPageProps {
    params: Promise<{
        id: string
    }>
}

export default function CourierDetailPage({ params }: CourierDetailPageProps) {
    const { id } = use(params)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isBulkOpen, setIsBulkOpen] = useState(false)

    const { data: courier, isLoading } = useQuery({
        queryKey: ['courier', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('couriers')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            return data
        }
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-gray-500">Loading courier details...</p>
            </div>
        )
    }

    if (!courier) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-red-500">Courier not found</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title={`${courier.courier_name} Details`}
                subtitle="Manage delivery locations and charges"
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
                    <CourierLocationList courierId={id} />
                </CardContent>
            </Card>

            <AddCourierLocationDialog
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                courierId={id}
            />

            <BulkUploadCourierLocationsDialog
                isOpen={isBulkOpen}
                onClose={() => setIsBulkOpen(false)}
                courierId={id}
            />
        </div>
    )
}
