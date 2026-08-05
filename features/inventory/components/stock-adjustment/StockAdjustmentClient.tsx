'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PackageOpen, ArrowRightLeft, PenTool, Wand2 } from 'lucide-react'
import OpeningStock from './OpeningStock'
import ManualAdjustment from './ManualAdjustment'
import AutoAdjustment from './AutoAdjustment'

type TabType = 'opening' | 'transfer' | 'manual' | 'auto'

export default function StockAdjustmentClient() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabType>('opening')

    return (
        <div className="space-y-6">
            {/* Header Section with Back Button */}
            <div className="hidden md:flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock Adjustment</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage opening stock, transfers, and manual adjustments</p>
                </div>
                <button
                    onClick={() => router.push('/dashboard/inventory')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
                >
                    <ArrowLeft size={18} />
                    <span>Back to Dashboard</span>
                </button>
            </div>

            {/* Navigation Tabs */}
            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-2 border-b-0 md:border-b dark:border-zinc-700 pb-0 md:pb-1">
                <TabButton
                    active={activeTab === 'opening'}
                    onClick={() => setActiveTab('opening')}
                    icon={<PackageOpen size={18} />}
                    label="Opening Stock"
                />
                <TabButton
                    active={activeTab === 'transfer'}
                    onClick={() => setActiveTab('transfer')}
                    icon={<ArrowRightLeft size={18} />}
                    label="Transfer Stock"
                />
                <TabButton
                    active={activeTab === 'manual'}
                    onClick={() => setActiveTab('manual')}
                    icon={<PenTool size={18} />}
                    label="Manual Adjustment"
                />
                <TabButton
                    active={activeTab === 'auto'}
                    onClick={() => setActiveTab('auto')}
                    icon={<Wand2 size={18} />}
                    label="Auto Adjustment"
                />
            </div>

            {/* Content Section */}
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border dark:border-zinc-700 min-h-[400px] p-6">
                {activeTab === 'opening' && <OpeningStock />}

                {activeTab === 'transfer' && (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                        Transfer Stock Module Coming Soon
                    </div>
                )}

                {activeTab === 'manual' && <ManualAdjustment />}

                {activeTab === 'auto' && <AutoAdjustment />}
            </div>
        </div>
    )
}

function TabButton({
    active,
    onClick,
    icon,
    label
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center justify-center md:justify-start gap-2 px-4 py-2.5 text-sm font-medium transition-all relative
                rounded-lg md:rounded-t-lg md:rounded-b-none
                ${active
                    ? 'bg-white md:bg-white dark:bg-zinc-800 text-black md:text-blue-600 dark:text-white border border-black md:border-x-0 md:border-t-0 md:border-b-2 md:border-blue-600 dark:border dark:border-blue-500/50 dark:shadow-[0_0_0_1px_rgba(59,130,246,0.5)]'
                    : 'bg-white md:bg-transparent text-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-zinc-700/50 hover:text-gray-900 border border-gray-200 md:border-x-0 md:border-t-0 md:border-b-2 md:border-transparent dark:bg-zinc-800/50 dark:border dark:border-zinc-700'
                }
            `}
        >
            {icon}
            {label}
        </button>
    )
}
