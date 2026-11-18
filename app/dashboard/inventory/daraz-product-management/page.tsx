'use client'

import { useState } from 'react'
import { Package, Sparkles, ShoppingBag, BookOpen } from 'lucide-react'
import { useDashboard } from '../../context'
import DarazProductsTab from './DarazProductsTab'
import NewListingTab from './NewListingTab'
import AiInstructionModal from './AiInstructionModal'

export default function DarazProductManagementPage() {
    const { setIsMobileMenuOpen } = useDashboard()
    const [activeTab, setActiveTab] = useState<'new-listing' | 'products'>('new-listing')
    const [isInstructionOpen, setIsInstructionOpen] = useState(false)
    
    // Shared state for pre-filling "New Listing" when pushing an existing product
    const [prefilledData, setPrefilledData] = useState<any>(null)

    const handlePushToAnotherAccount = (productData: any) => {
        setPrefilledData(productData)
        setActiveTab('new-listing')
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/70 dark:bg-zinc-950 font-[family-name:var(--font-inter)]">
            {/* Page Heading Bar */}
            <div className="bg-white dark:bg-zinc-900 border-b border-slate-200/80 dark:border-zinc-800 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0">
                            <Package size={16} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                                Daraz Product Management
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                                Manage product listings, images, seller accounts, pricing, quality checks, and publishing across your Daraz stores.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Header Actions & Tabs Switcher */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setIsInstructionOpen(true)}
                        className="h-8 px-3 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    >
                        <BookOpen size={13} className="text-slate-500 dark:text-zinc-400" />
                        AI Instruction
                    </button>

                    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200/80 dark:border-zinc-700/80">
                        <button
                            type="button"
                            onClick={() => setActiveTab('new-listing')}
                            className={`h-7 px-3 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'new-listing'
                                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs border border-slate-200/80 dark:border-zinc-700'
                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                            }`}
                        >
                            <Sparkles size={13} className={activeTab === 'new-listing' ? 'text-orange-500' : 'text-slate-400'} />
                            New Listing
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveTab('products')
                                setPrefilledData(null) // clear on manual switch
                            }}
                            className={`h-7 px-3 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === 'products'
                                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs border border-slate-200/80 dark:border-zinc-700'
                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                            }`}
                        >
                            <ShoppingBag size={13} className={activeTab === 'products' ? 'text-orange-500' : 'text-slate-400'} />
                            Daraz Products
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                {activeTab === 'products' ? (
                    <DarazProductsTab onPushToAnotherAccount={handlePushToAnotherAccount} />
                ) : (
                    <NewListingTab prefilledData={prefilledData} onClearPrefilled={() => setPrefilledData(null)} />
                )}
            </div>

            <AiInstructionModal
                isOpen={isInstructionOpen}
                onClose={() => setIsInstructionOpen(false)}
            />
        </div>
    )
}
