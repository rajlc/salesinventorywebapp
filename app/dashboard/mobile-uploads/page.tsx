'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getMobileCaptures } from '@/features/mobile-capture/actions'
import { GalleryGrid } from '@/features/mobile-capture/components/GalleryGrid'

type Capture = Awaited<ReturnType<typeof getMobileCaptures>>[number]

export default function MobileUploadsPage() {
    const router = useRouter()
    const [captures, setCaptures] = useState<Capture[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadCaptures() {
            try {
                const data = await getMobileCaptures()
                setCaptures(data)
            } finally {
                setLoading(false)
            }
        }
        loadCaptures()
    }, [])

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header Section with Back Button */}
            <div className="hidden md:flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Field Data Entry</h1>
                    <span className="text-sm text-gray-500">
                        {captures.length} photos
                    </span>
                </div>
                <button
                    onClick={() => router.push('/dashboard/inventory')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Dashboard</span>
                </button>
            </div>

            <GalleryGrid captures={captures} />

            {captures.length === 0 && (
                <div className="py-20 text-center text-gray-500 border-2 border-dashed rounded-lg">
                    <p className="text-lg font-medium">No photos found</p>
                    <p className="text-sm mt-1">
                        Use the mobile app to capture product photos instantly.
                    </p>
                </div>
            )}
        </div>
    )
}
