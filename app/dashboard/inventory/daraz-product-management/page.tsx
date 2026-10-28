'use client'

import { useState } from 'react'
import { Package, Sparkles, ShoppingBag } from 'lucide-react'
import { useDashboard } from '../../context'
import DarazProductsTab from './DarazProductsTab'
import NewListingTab from './NewListingTab'

export default function DarazProductManagementPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const [activeTab, setActiveTab] = useState<'new-listing' | 'products'>('new-listing')
    
    // Shared state for pre-filling "New Listing" when pushing an existing product
    const [prefilledData, setPrefilledData] = useState<any>(null)

    const handlePushToAnotherAccount = (productData: any) => {
        setPrefilledData(productData)
        setActiveTab('new-listing')
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 space-y-4 font-[family-name:var(--font-inter)]">
            {/* Top Navigation Bar */}
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-5 py-3 shadow-xs sticky top-0 z-40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
                        <Package size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-zinc-100 leading-tight">
                            Daraz Product Management
                        </h1>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium">
                            Multi-Store Publishing, Profit & Catalog Engine
                        </p>
                    </div>
                </div>

                {/* Unique Header Tabs Switcher */}
                <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 dark:bg-zinc-800/80 rounded-xl border border-gray-200/80 dark:border-zinc-700/80 shadow-2xs">
                    <button
                        type="button"
                        onClick={() => setActiveTab('new-listing')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'new-listing'
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25 ring-1 ring-white/20'
                                : 'text-gray-600 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white/70 dark:hover:bg-zinc-700/60'
                        }`}
                    >
                        <Sparkles size={14} className={activeTab === 'new-listing' ? 'text-white' : 'text-orange-500'} />
                        New Listing
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('products')
                            setPrefilledData(null) // clear on manual switch
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'products'
                                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 shadow-md border border-gray-200 dark:border-zinc-700'
                                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-white/70 dark:hover:bg-zinc-700/60'
                        }`}
                    >
                        <ShoppingBag size={14} className={activeTab === 'products' ? 'text-orange-500' : 'text-gray-400'} />
                        Daraz Products
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
