'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BarChart2, List, FileText, FileStack, Users, PieChart } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'

import PurchaseListContent from '@/features/purchase/components/PurchaseListContent'
import DailyReportTab from '@/features/purchase/components/DailyReportTab'
import DailyPurchaseListContent from '@/features/purchase/components/DailyPurchaseListContent'
import BuySellSuppliersContent from '@/features/purchase/components/BuySellSuppliersContent'
import PurchaseReportsContent from '@/features/purchase/components/PurchaseReportsContent'
import MrpListContent from '@/features/purchase/components/MrpListContent'
import { usePermissions } from '@/lib/permissions/PermissionContext'
import { Forbidden403 } from '@/components/permissions/Forbidden403'

type Tab = 'all-list' | 'daily-report' | 'daily-list' | 'buy-sell' | 'reports' | 'mrp-list'

export default function PurchaseDashboardSubPage() {
    const { hasPermission, isLoading } = usePermissions()
    const [activeTab, setActiveTab] = useState<Tab>('all-list')

    // Auto-select first available tab if current is not permitted
    useEffect(() => {
        if (isLoading) return

        const availableTabs = [
            { id: 'all-list', has: hasPermission('Purchase', 'All Purchase List') },
            { id: 'daily-report', has: hasPermission('Purchase', 'Daily Report') },
            { id: 'daily-list', has: hasPermission('Purchase', 'Purchase List') },
            { id: 'buy-sell', has: hasPermission('Purchase', 'Buy/sell (Suppliers)') },
            { id: 'reports', has: hasPermission('Purchase', 'Purchase Reports') },
            { id: 'mrp-list', has: true }
        ].filter(t => t.has)

        if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
            setActiveTab(availableTabs[0].id as Tab)
        }
    }, [hasPermission, activeTab, isLoading])

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500">Checking permissions...</div>
    }

    const hasAnyAccess = hasPermission('Purchase', 'All Purchase List') || 
                         hasPermission('Purchase', 'Daily Report') || 
                         hasPermission('Purchase', 'Purchase List') ||
                         hasPermission('Purchase', 'Buy/sell (Suppliers)') ||
                         hasPermission('Purchase', 'Purchase Reports')

    if (!hasAnyAccess) {
        return <Forbidden403 />
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                <div>
                    <h1 className="text-[17px] font-bold">Purchase Dashboard</h1>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400">Overview & Reports</p>
                </div>
                <Link
                    href="/dashboard/purchase"
                    className="flex items-center gap-1 px-2 py-1 text-[13px] bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                >
                    <ArrowLeft size={12} />
                    Back to Dashboard
                </Link>
            </div>

            {/* Tab Bar */}
            <div className="sticky top-0 md:top-[44px] z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-1.5 min-w-max">
                    {hasPermission('Purchase', 'All Purchase List') && (
                        <button
                            onClick={() => setActiveTab('all-list')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'all-list'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <List size={12} />
                            All Purchase List
                        </button>
                    )}
                    {hasPermission('Purchase', 'Daily Report') && (
                        <button
                            onClick={() => setActiveTab('daily-report')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'daily-report'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <BarChart2 size={12} />
                            Daily Report
                        </button>
                    )}
                    {hasPermission('Purchase', 'Purchase List') && (
                        <button
                            onClick={() => setActiveTab('daily-list')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'daily-list'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <FileStack size={12} />
                            Purchase List
                        </button>
                    )}
                    {hasPermission('Purchase', 'Buy/sell (Suppliers)') && (
                        <button
                            onClick={() => setActiveTab('buy-sell')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'buy-sell'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <Users size={12} />
                            Buy/Sell (Suppliers)
                        </button>
                    )}
                    {hasPermission('Purchase', 'Purchase Reports') && (
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'reports'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                }`}
                        >
                            <PieChart size={12} />
                            Purchase Reports
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('mrp-list')}
                        className={`flex items-center gap-1 px-2 py-1 text-sm rounded transition-colors ${activeTab === 'mrp-list'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        <FileText size={12} />
                        MRP List
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'all-list' && hasPermission('Purchase', 'All Purchase List') && (
                    <PurchaseListContent isEmbedded={true} />
                )}
                {activeTab === 'daily-report' && hasPermission('Purchase', 'Daily Report') && (
                    <DailyReportTab />
                )}
                {activeTab === 'daily-list' && hasPermission('Purchase', 'Purchase List') && (
                    <DailyPurchaseListContent isEmbedded={true} />
                )}
                {activeTab === 'buy-sell' && hasPermission('Purchase', 'Buy/sell (Suppliers)') && (
                    <BuySellSuppliersContent isEmbedded={true} />
                )}
                {activeTab === 'reports' && hasPermission('Purchase', 'Purchase Reports') && (
                    <PurchaseReportsContent isEmbedded={true} />
                )}
                {activeTab === 'mrp-list' && (
                    <MrpListContent isEmbedded={true} />
                )}
            </div>
        </div>
    )
}
