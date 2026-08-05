import { StockAnalysisPage } from '@/features/stock-analysis/components/StockAnalysisPage'

export default function Page() {
    return (
        <div className="min-h-full bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-6 py-4">
                <h1 className="text-xl font-bold">Stock Analysis</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Track opening stock, purchases, and running stock based on fiscal years
                </p>
            </div>

            {/* Content */}
            <div className="p-6">
                <StockAnalysisPage />
            </div>
        </div>
    )
}
