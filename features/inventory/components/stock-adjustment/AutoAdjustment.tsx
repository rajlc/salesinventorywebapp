'use client'

import { useState, useEffect } from 'react'
import { Bot, Info, X } from 'lucide-react'
import { getAutoAdjustments, AutoAdjustment as AutoAdjustmentType } from '@/features/inventory/actions/stock-adjustment-actions'

export default function AutoAdjustment() {
    const [adjustments, setAdjustments] = useState<AutoAdjustmentType[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [viewDetailsItem, setViewDetailsItem] = useState<AutoAdjustmentType | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const data = await getAutoAdjustments()
                setAdjustments(data)
            } catch (error) {
                console.error('Failed to load auto adjustments', error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                    <Bot size={24} />
                    <h3 className="font-bold text-lg">Automatic Stock Adjustments</h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Info size={16} />
                    <p>These adjustments are automatically created by the system when Combo products are sold or returned</p>
                </div>
            </div>

            {/* History Section */}
            <div className="space-y-4">
                <div className="pb-2 border-b dark:border-zinc-700">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">Automatic Adjustment History</h3>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border dark:border-zinc-700 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white font-medium border-b dark:border-white/10">
                            <tr>
                                <th className="px-4 py-3 hidden md:table-cell">Date</th>
                                <th className="px-4 py-3">Component</th>
                                <th className="px-4 py-3">Qty</th>
                                <th className="px-4 py-3 hidden md:table-cell">Combo Product</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                                <th className="px-4 py-3 hidden md:table-cell">Stock</th>
                                <th className="px-4 py-3 hidden md:table-cell">Created By</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-zinc-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        Loading automatic adjustments...
                                    </td>
                                </tr>
                            ) : adjustments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        No automatic adjustments found for combo products.
                                    </td>
                                </tr>
                            ) : (
                                adjustments.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 align-top">
                                        <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">{new Date(item.date).toLocaleDateString()}</td>

                                        {/* Component List - Clickable on Mobile */}
                                        <td className="px-4 py-3 cursor-pointer md:cursor-default" onClick={() => setViewDetailsItem(item)}>
                                            <div className="flex flex-col gap-1">
                                                {item.components.map((comp, idx) => (
                                                    <div key={idx} className="font-medium text-blue-600 dark:text-blue-400 md:text-gray-900 md:dark:text-gray-200">
                                                        {comp.name}
                                                    </div>
                                                ))}
                                                <div className="md:hidden text-xs text-gray-400 mt-1">(Tap for details)</div>
                                            </div>
                                        </td>

                                        {/* Qty List */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                {item.components.map((comp, idx) => (
                                                    <div key={idx} className="font-mono text-purple-600 dark:text-purple-400 font-semibold">
                                                        {comp.qty_display}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{item.combo_product_name}</td>

                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${item.source === 'Daraz' ? 'bg-orange-100 text-orange-700' :
                                                    item.source === 'Marketplace' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                    {item.source}
                                                </span>
                                                <span className="md:hidden px-2 py-1 rounded-full text-xs border bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700">
                                                    {item.status}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <span className="px-2 py-1 rounded-full text-xs border bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700">
                                                {item.status}
                                            </span>
                                        </td>

                                        {/* Stock List with Colors */}
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <div className="flex flex-col gap-1">
                                                {item.components.map((comp, idx) => (
                                                    <div key={idx} className={`font-semibold ${comp.stock_effect === 'negative' ? 'text-red-500' :
                                                        comp.stock_effect === 'positive' ? 'text-green-500' :
                                                            'text-gray-400'
                                                        }`}>
                                                        {comp.stock_display}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>

                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{item.created_by_name}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* View Details Modal for Mobile */}
            {viewDetailsItem && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={() => setViewDetailsItem(null)}
                >
                    <div
                        className="bg-white dark:bg-zinc-900 rounded-lg w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setViewDetailsItem(null)}
                            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <X size={20} />
                        </button>
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Adjustment Details</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Date</label>
                                    <div className="font-medium dark:text-white">{new Date(viewDetailsItem.date).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Source</label>
                                    <div className="font-medium dark:text-white">{viewDetailsItem.source}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
                                    <div className="font-medium dark:text-white">{viewDetailsItem.status}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 dark:text-gray-400">Created By</label>
                                    <div className="font-medium dark:text-white">{viewDetailsItem.created_by_name}</div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 dark:text-gray-400">Combo Product</label>
                                <div className="font-medium dark:text-white">{viewDetailsItem.combo_product_name}</div>
                            </div>

                            <div className="border-t dark:border-zinc-700 pt-4">
                                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">Component Stock Effects</label>
                                <div className="space-y-3">
                                    {viewDetailsItem.components.map((comp, idx) => (
                                        <div key={idx} className="bg-gray-50 dark:bg-zinc-800 p-3 rounded text-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium dark:text-white">{comp.name}</span>
                                                <span className={`font-bold ${comp.stock_effect === 'negative' ? 'text-red-500' :
                                                    comp.stock_effect === 'positive' ? 'text-green-500' :
                                                        'text-gray-400'
                                                    }`}>{comp.stock_display}</span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Qty: {comp.qty_display}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
