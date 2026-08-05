'use client'

import { useState } from 'react'
import { ArrowLeft, Package, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '../../context'
import DarazProductsTab from './DarazProductsTab'
import NewListingTab from './NewListingTab'

export default function DarazProductManagementPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const [activeTab, setActiveTab] = useState<'products' | 'new-listing'>('products')
    
    // Shared state for pre-filling "New Listing" when pushing an existing product
    const [prefilledData, setPrefilledData] = useState<any>(null)

    const handlePushToAnotherAccount = (productData: any) => {
        setPrefilledData(productData)
        setActiveTab('new-listing')
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4">
            {/* Top Navigation Bar */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 shadow-sm sticky top-0 z-40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/inventory" className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Package className="text-orange-500" size={24} />
                        Daraz Product Management
                    </h1>
                </div>

                {/* Tabs Switcher */}
                <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg border dark:border-zinc-700">
                    <button
                        onClick={() => {
                            setActiveTab('products')
                            setPrefilledData(null) // clear on manual switch
                        }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                            activeTab === 'products'
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-zinc-200'
                        }`}
                    >
                        Daraz Products
                    </button>
                    <button
                        onClick={() => setActiveTab('new-listing')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                            activeTab === 'new-listing'
                                ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-950 dark:hover:text-zinc-200'
                        }`}
                    >
                        <Sparkles size={14} className="text-orange-500" />
                        New Listing
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-8">
                {activeTab === 'products' ? (
                    <DarazProductsTab onPushToAnotherAccount={handlePushToAnotherAccount} />
                ) : (
                    <NewListingTab prefilledData={prefilledData} onClearPrefilled={() => setPrefilledData(null)} />
                )}
            </div>
        </div>
    )
}
