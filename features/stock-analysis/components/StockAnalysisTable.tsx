'use client'

import { Snowflake } from 'lucide-react'
import { StockAnalysisItem } from '../actions/stock-analysis-actions'
import { formatNepaliCurrency } from '@/lib/utils/date-converter'

interface StockAnalysisTableProps {
    data: StockAnalysisItem[]
    isLoading: boolean
    frozenProducts?: Set<string>
    onToggleFreeze?: (particulars: string) => void
}

export function StockAnalysisTable({ data, isLoading, frozenProducts = new Set(), onToggleFreeze }: StockAnalysisTableProps) {
    // Calculate Footer Totals
    const totalRunningStock = data.reduce((sum, item) => sum + item.running_stock, 0)

    const totalStockValuation = data.reduce((sum, item) => {
        return sum + (item.running_stock * item.weighted_average_rate)
    }, 0)

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
                            <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {data.map((item, index) => {
                            const isFrozen = frozenProducts.has(item.particulars)
                            return (
                                <tr
                                    key={index}
                                    className={`transition-colors ${isFrozen
                                        ? 'bg-orange-50/60 dark:bg-orange-950/10 opacity-75'
                                        : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                >
                                    <td className={`px-6 py-3 sticky left-0 ${isFrozen ? 'bg-orange-50/60 dark:bg-orange-950/10' : 'bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}>
                                        {index + 1}
                                    </td>
                                    <td className="px-6 py-3">{item.hs_code || '-'}</td>
                                    <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                                        <div className="flex items-center gap-2">
                                            {item.particulars}
                                            {isFrozen && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold rounded-md border border-orange-200 dark:border-orange-800">
                                                    <Snowflake className="h-2.5 w-2.5" />
                                                    FROZEN
                                                </span>
                                            )}
                                        </div>
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
                                    <td className="px-6 py-3 text-center">
                                        {onToggleFreeze && (
                                            <button
                                                onClick={() => onToggleFreeze(item.particulars)}
                                                title={isFrozen ? 'Unfreeze — include in bill generation' : 'Freeze — exclude from bill generation'}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all duration-150 active:scale-95 ${isFrozen
                                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-200 dark:hover:border-orange-800'
                                                    }`}
                                            >
                                                <Snowflake className="h-3 w-3" />
                                                {isFrozen ? 'Unfreeze' : 'Freeze'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
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
                            <td className="px-6 py-3" />
                        </tr>
                        <tr>
                            <td colSpan={8} className="px-6 py-3 text-right">
                                Total Purchase Amount :
                            </td>
                            <td className="px-6 py-3 text-right text-green-700 dark:text-green-400">
                                {formatNepaliCurrency(totalPurchaseAmount)}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={8} className="px-6 py-3 text-right">
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
