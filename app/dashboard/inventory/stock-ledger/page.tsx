
import { Metadata } from 'next'
import { getStockLedger } from '@/features/inventory/services/stock-ledger-service'
import StockLedgerView from '@/features/inventory/components/StockLedgerView'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
    title: 'Stock Ledger | Bagmati ERP',
    description: 'View detailed stock movement history'
}

export default async function StockLedgerPage() {
    // Initial fetch (100 per page to match component)
    const { data, totalCount, totalPages } = await getStockLedger(1, 100, '')

    return (
        <div className="p-0 md:p-6 space-y-6">
            {/* Header - Global Top Bar style on Mobile */}
            <div className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-zinc-950 border-b dark:border-zinc-800 p-4 md:static md:border-b-0 md:bg-transparent md:p-0 flex items-center justify-between shadow-sm md:shadow-none">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Stock Ledger</h1>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">View Detailed Stock Movement History</p>
                </div>

                <Link
                    href="/dashboard/inventory"
                    className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span>Back to Inventory</span>
                </Link>
            </div>

            {/* Content Spacer for Mobile Fixed Header */}
            <div className="h-16 md:hidden"></div>

            {/* Client Table */}
            {/* Client View with Tabs */}
            <StockLedgerView
                initialData={data}
                initialTotal={totalCount}
                initialPages={totalPages}
            />
        </div>
    )
}
