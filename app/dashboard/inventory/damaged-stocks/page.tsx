'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import DamagedStock from "@/features/inventory/components/stock-adjustment/DamagedStock"

export default function DamagedStocksPage() {
    const router = useRouter()

    return (
        <div className="space-y-6">
            {/* Header Section with Back Button */}
            <div className="hidden md:flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Damaged Goods</h1>
                    <p className="text-gray-500">Record and manage damaged, repaired, or exchanged items.</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/inventory')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Dashboard</span>
                </button>
            </div>

            <DamagedStock />
        </div>
    )
}
