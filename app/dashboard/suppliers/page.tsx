'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Users, FileText, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import SuppliersListContent from '@/features/suppliers/components/SuppliersListContent'
import SuppliersTransactionContent from '@/features/suppliers/components/SuppliersTransactionContent'
import SuppliersLedgerContent from '@/features/suppliers/components/SuppliersLedgerContent'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { Forbidden403 } from '@/components/permissions/Forbidden403'

type Tab = 'list' | 'transaction' | 'ledger'

export default function SuppliersPage() {
    const { hasPermission, isLoading } = usePermissions()
    const [activeTab, setActiveTab] = useState<Tab>('ledger')

    useEffect(() => {
        if (isLoading) return

        const availableTabs = [
            { id: 'ledger', has: hasPermission('Suppliers', 'Suppliers Ledger') },
            { id: 'transaction', has: hasPermission('Suppliers', 'Supplier Transactions') },
            { id: 'list', has: hasPermission('Purchase', 'Supplier List') }
        ].filter(t => t.has)

        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id as Tab)
        }
    }, [hasPermission, activeTab, isLoading])

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Checking permissions...</div>
    }

    const hasAnyAccess = hasPermission('Suppliers', 'Suppliers Ledger') || 
                         hasPermission('Suppliers', 'Supplier Transactions') || 
                         hasPermission('Purchase', 'Supplier List')

    if (!hasAnyAccess) {
        return <Forbidden403 />
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header - Desktop */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Supplier Management</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Manage suppliers & transactions</p>
                </div>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Tab Bar - Desktop Only */}
            <div className="hidden md:block sticky top-0 md:top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    {hasPermission('Purchase', 'Supplier List') && (
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'list'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <Users size={12} />
                            Supplier List
                        </button>
                    )}
                    {hasPermission('Suppliers', 'Supplier Transactions') && (
                        <button
                            onClick={() => setActiveTab('transaction')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'transaction'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <FileText size={12} />
                            Suppliers Transaction
                        </button>
                    )}
                    {hasPermission('Suppliers', 'Suppliers Ledger') && (
                        <button
                            onClick={() => setActiveTab('ledger')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'ledger'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <TrendingUp size={12} />
                            Supplier Ledger
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'list' && hasPermission('Purchase', 'Supplier List') && (
                    <SuppliersListContent isEmbedded={true} />
                )}
                {activeTab === 'transaction' && hasPermission('Suppliers', 'Supplier Transactions') && (
                    <SuppliersTransactionContent isEmbedded={true} />
                )}
                {activeTab === 'ledger' && hasPermission('Suppliers', 'Suppliers Ledger') && (
                    <SuppliersLedgerContent isEmbedded={true} />
                )}
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t dark:border-zinc-800 z-50 px-2 py-2 pb-safe">
                <div className="flex items-center gap-2">
                    {hasPermission('Suppliers', 'Suppliers Ledger') && (
                        <button
                            onClick={() => setActiveTab('ledger')}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'ledger'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <TrendingUp size={20} />
                            <span className="text-xs font-medium">Ledger</span>
                        </button>
                    )}
                    {hasPermission('Suppliers', 'Supplier Transactions') && (
                        <button
                            onClick={() => setActiveTab('transaction')}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'transaction'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <FileText size={20} />
                            <span className="text-xs font-medium">Transaction</span>
                        </button>
                    )}
                    {hasPermission('Purchase', 'Supplier List') && (
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-colors ${activeTab === 'list'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                }`}
                        >
                            <Users size={20} />
                            <span className="text-xs font-medium">List</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
