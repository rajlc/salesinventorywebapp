'use client'

import { StockAnalysisItem } from '../actions/stock-analysis-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

interface StockAnalysisTableProps {
    data: StockAnalysisItem[]
    isLoading: boolean
}

export function StockAnalysisTable({ data, isLoading }: StockAnalysisTableProps) {
    // Calculate Footer Totals
    const totalRunningStock = data.reduce((sum, item) => sum + item.running_stock, 0)

    // Valuation: Running Stock * Weighted Average Rate
    // If rate is 0 (no purchase this period), value is 0 for this calculation model 
    // unless we assume opening stock value which we don't have.
    // User asked "stock valuation = running stock valuation".
    // "Running Stock Valuation" usually means Current Qty * Current Cost Price.
    const totalStockValuation = data.reduce((sum, item) => {
        return sum + (item.running_stock * item.weighted_average_rate)
    }, 0)

    // Total Purchase Amount (should match Purchase Billing Report)
    const totalPurchaseAmount = data.reduce((sum, item) => {
        return sum + item.purchase_amount
    }, 0)

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-8 text-center text-gray-500">
                Loading stock analysis...
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 p-8 text-center text-gray-500">
                No stock data found for the selected criteria.
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 font-medium border-b dark:border-zinc-700">
                        <tr>
                            <th className="px-6 py-3 sticky left-0 bg-gray-50 dark:bg-zinc-800">S.N</th>
                            <th className="px-6 py-3">H.S Code</th>
                            <th className="px-6 py-3">Particulars</th>
                            <th className="px-6 py-3 text-right">Opening Stock</th>
                            <th className="px-6 py-3 text-right">Purchase Stock</th>
                            <th className="px-6 py-3 text-right">Purchase Rate</th>
                            <th className="px-6 py-3 text-right">Sales Qty</th>
                            <th className="px-6 py-3 text-right font-semibold">Running Stock</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="px-6 py-3 sticky left-0 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                    {index + 1}
                                </td>
                                <td className="px-6 py-3">{item.hs_code || '-'}</td>
                                <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                                    {item.particulars}
                                </td>
                                <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400">
                                    {item.opening_stock}
                                </td>
                                <td className="px-6 py-3 text-right text-green-600 dark:text-green-400">
                                    {item.purchase_stock}
                                </td>
                                <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-400">
                                    {formatNepaliCurrency(item.weighted_average_rate)}
                                </td>
                                <td className="px-6 py-3 text-right text-red-600 dark:text-red-400">
                                    {item.sales_qty}
                                </td>
                                <td className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10">
                                    {item.running_stock}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-100 dark:bg-zinc-800 font-semibold border-t dark:border-zinc-700">
                        <tr>
                            <td colSpan={3} className="px-6 py-3 text-right">Totals</td>
                            <td className="px-6 py-3 text-right">-</td>
                            <td className="px-6 py-3 text-right">-</td>
                            <td className="px-6 py-3 text-right">-</td>
                            <td className="px-6 py-3 text-right">-</td>
                            <td className="px-6 py-3 text-right text-blue-700 dark:text-blue-400">
                                {totalRunningStock}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={7} className="px-6 py-3 text-right">
                                Total Purchase Amount :
                            </td>
                            <td className="px-6 py-3 text-right text-green-700 dark:text-green-400">
                                {formatNepaliCurrency(totalPurchaseAmount)}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={7} className="px-6 py-3 text-right">
                                Total Stock Valuation :
                            </td>
                            <td className="px-6 py-3 text-right text-blue-700 dark:text-blue-400">
                                {formatNepaliCurrency(totalStockValuation)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    )
}
