'use client'

import { useState, useEffect } from 'react'
import { useOnlineStores } from '@/features/settings/hooks/useStores'
import { Store, AlertCircle } from 'lucide-react'
import { AccountStatementView } from '@/features/account/components/AccountStatementView'

export default function DarazAccountPage() {
    return (
        <DarazAccountContent />
    )
}

function DarazAccountContent() {
    const { data: stores, isLoading: isStoresLoading } = useOnlineStores()
    const [selectedStoreId, setSelectedStoreId] = useState<string>('')
    const [activeTab, setActiveTab] = useState<'report' | 'account-statement'>('account-statement')

    // Select first store by default
    useEffect(() => {
        if (stores && stores.length > 0 && !selectedStoreId) {
            setSelectedStoreId(stores[0].id)
        }
    }, [stores, selectedStoreId])

    const selectedStore = stores?.find(s => s.id === selectedStoreId)

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daraz Account</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Financial statements and ledger
                            </p>
                        </div>


                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800">
                        <button
                            onClick={() => setActiveTab('account-statement')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'account-statement'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Account Statement
                        </button>
                        <button
                            onClick={() => setActiveTab('report')}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'report'
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Report
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6">
                {selectedStoreId ? (
                    activeTab === 'account-statement' ? (
                        <AccountStatementView storeId={selectedStoreId} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                            <p>Report View is coming soon</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        Please select a store to view accounts.
                    </div>
                )}
            </div>
        </div>
    )
}
