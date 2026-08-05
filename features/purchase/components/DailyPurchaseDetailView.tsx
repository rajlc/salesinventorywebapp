'use client'

import { useMemo } from 'react'
import { Link } from 'lucide-react' // Note: This import seems unused/incorrect based on usage below, checking icons
import { ArrowLeft, Wallet, CreditCard, Banknote, HelpCircle, Users as UsersIcon } from 'lucide-react'
import { Card } from '@/components/ui-shim'
import { Purchase } from '@/features/purchase/actions/purchase-actions'

interface DailyPurchaseDetailViewProps {
    date: string
    purchases: Purchase[]
    isLoading: boolean
    onBack?: () => void
}

export default function DailyPurchaseDetailView({ date, purchases, isLoading, onBack }: DailyPurchaseDetailViewProps) {

    // Calculate Payment Type Stats
    const paymentStats = useMemo(() => {
        if (!purchases) return { rows: [], grandTotal: 0, grandSales: 0, grandPurchase: 0 }

        const stats: Record<string, { total: number, sales: number, purchase: number }> = {}
        let grandTotal = 0
        let grandSales = 0
        let grandPurchase = 0

        purchases.forEach((p: Purchase) => {
            const type = p.payment_type || 'Others'
            if (!stats[type]) {
                stats[type] = { total: 0, sales: 0, purchase: 0 }
            }
            stats[type].total += p.total_amount
            grandTotal += p.total_amount

            const pType = (p.purchase_type || '').toLowerCase()
            if (pType === 'sell') {
                stats[type].sales += p.total_amount
                grandSales += p.total_amount
            } else if (pType === 'buy') {
                stats[type].purchase += p.total_amount
                grandPurchase += p.total_amount
            }
        })

        const rows = Object.entries(stats).map(([type, data]) => ({ type, ...data }))
        return { rows, grandTotal, grandSales, grandPurchase }
    }, [purchases])

    // Sort purchases for History: Sell first
    const sortedPurchases = useMemo(() => {
        if (!purchases) return []
        return [...purchases].sort((a, b) => {
            const typeA = (a.purchase_type || '').toLowerCase()
            const typeB = (b.purchase_type || '').toLowerCase()
            if (typeA === 'sell' && typeB !== 'sell') return -1
            if (typeA !== 'sell' && typeB === 'sell') return 1
            return 0
        })
    }, [purchases])

    // Calculate Supplier Stats
    const supplierStats = useMemo(() => {
        if (!purchases) return []

        const stats: Record<string, {
            buy: { amount: number, count: number },
            sell: { amount: number, count: number }
        }> = {}

        purchases.forEach((p: Purchase) => {
            const supplier = p.supplier?.supplier_name || 'Unknown'
            const type = (p.purchase_type || '').toLowerCase()

            if (!stats[supplier]) {
                stats[supplier] = {
                    buy: { amount: 0, count: 0 },
                    sell: { amount: 0, count: 0 }
                }
            }

            if (type === 'sell') {
                stats[supplier].sell.amount += p.total_amount
                stats[supplier].sell.count += 1
            } else {
                // Default everything else to buy if not sell 
                // Or explicitly check 'buy' if needed, but 'sell' is the exception usually
                stats[supplier].buy.amount += p.total_amount
                stats[supplier].buy.count += 1
            }
        })

        return Object.entries(stats)
            .map(([name, data]) => ({
                name,
                totalAmount: data.buy.amount + data.sell.amount,
                ...data
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount)
    }, [purchases])

    // Get Icon for Payment Type
    const getPaymentIcon = (type: string) => {
        switch (type) {
            case 'Cash': return <Banknote size={16} className="text-green-600" />
            case 'Online': return <CreditCard size={16} className="text-blue-600" />
            case 'Due': return <Wallet size={16} className="text-red-600" />
            default: return <HelpCircle size={16} className="text-gray-600" />
        }
    }

    // Date formatter
    const formatDate = (dateStr: string) => {
        if (!dateStr) return ''
        const d = new Date(dateStr)
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-900 border-l dark:border-zinc-800 animate-in slide-in-from-right-10 duration-200">
            {/* Detail Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-3 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Top Row Removed - Date moved to global header */}

                    {/* Bottom/Right Row: Totals */}
                    <div className="flex items-center justify-between md:justify-end gap-2 md:gap-6 bg-gray-50 dark:bg-zinc-800/50 p-2 md:p-0 rounded-lg md:bg-transparent">
                        <div className="flex-1 md:flex-none text-center md:text-right px-2 md:px-0 border-r md:border-r-0 border-gray-200 dark:border-zinc-700 last:border-0">
                            <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider md:normal-case">Total Purchase</div>
                            <div className="text-sm md:text-md font-bold text-blue-600">
                                Rs {paymentStats.grandPurchase.toLocaleString()}
                            </div>
                        </div>
                        <div className="flex-1 md:flex-none text-center md:text-right px-2 md:px-0">
                            <div className="text-[10px] md:text-xs text-gray-500 uppercase tracking-wider md:normal-case">Total Sales</div>
                            <div className="text-sm md:text-md font-bold text-green-600">
                                Rs {paymentStats.grandSales.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-3 pb-24">
                {/* Top Section: Payment Types & Suppliers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Left: Payment Analysis */}
                    <Card className="p-3">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Wallet size={16} className="text-purple-500" />
                            Payment Analysis
                        </h3>
                        <div className="space-y-3">
                            {isLoading ? (
                                <div className="text-sm text-gray-500">Loading...</div>
                            ) : paymentStats.rows.length === 0 ? (
                                <div className="text-sm text-gray-500">No transactions found.</div>
                            ) : (
                                <>
                                    {/* Header Row */}
                                    <div className="flex text-xs font-semibold text-gray-500 border-b pb-2 mb-2">
                                        <div className="flex-1">Type</div>
                                        <div className="w-20 text-right">Sales</div>
                                        <div className="w-20 text-right">Purchase</div>
                                    </div>
                                    {/* Data Rows */}
                                    {paymentStats.rows.map((stat) => (
                                        <div key={stat.type} className="flex items-center justify-between py-1">
                                            <div className="flex-1 flex items-center gap-2">
                                                <div className="p-1 bg-gray-50 dark:bg-zinc-800 rounded">
                                                    {getPaymentIcon(stat.type)}
                                                </div>
                                                <span className="text-sm font-medium">{stat.type}</span>
                                            </div>
                                            <div className="w-20 text-right text-sm text-green-600 font-medium">
                                                Rs {stat.sales.toLocaleString()}
                                            </div>
                                            <div className="w-20 text-right text-sm text-blue-600 font-medium">
                                                Rs {stat.purchase.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                    {/* Footer Total Row */}
                                    <div className="flex text-xs font-bold text-gray-700 dark:text-gray-300 border-t pt-2 mt-2">
                                        <div className="flex-1">Total</div>
                                        <div className="w-20 text-right text-green-700">Rs {paymentStats.grandSales.toLocaleString()}</div>
                                        <div className="w-20 text-right text-blue-700">Rs {paymentStats.grandPurchase.toLocaleString()}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>

                    {/* Right: Supplier Breakdown */}
                    <Card className="p-3">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <UsersIcon className="text-orange-500" size={16} />
                            Supplier Breakdown
                        </h3>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                            {isLoading ? (
                                <div className="text-sm text-gray-500">Loading...</div>
                            ) : supplierStats.length === 0 ? (
                                <div className="text-sm text-gray-500">No supplier transactions.</div>
                            ) : (
                                supplierStats.map((stat) => (
                                    <div key={stat.name} className="py-2 border-b dark:border-zinc-800 last:border-0 border-dashed">
                                        {/* Sell Row */}
                                        {stat.sell.count > 0 && (
                                            <div className="flex items-center justify-between py-0.5 mb-1">
                                                <div className="text-sm truncate max-w-[70%] flex items-center gap-2" title={stat.name}>
                                                    <span>{stat.name}</span>
                                                    <span className="text-xs text-gray-400">({stat.sell.count})</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold uppercase tracking-wider">Sell</span>
                                                </div>
                                                <div className="text-sm font-bold text-green-600">
                                                    Rs {stat.sell.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        )}
                                        {/* Buy Row */}
                                        {stat.buy.count > 0 && (
                                            <div className="flex items-center justify-between py-0.5">
                                                <div className="text-sm truncate max-w-[70%] flex items-center gap-2" title={stat.name}>
                                                    <span>{stat.name}</span>
                                                    <span className="text-xs text-gray-400">({stat.buy.count})</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-bold uppercase tracking-wider">Buy</span>
                                                </div>
                                                <div className="text-sm font-bold text-blue-600">
                                                    Rs {stat.buy.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                {/* Bottom: Transaction List */}
                <Card>
                    <div className="px-4 py-3 border-b dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
                        <h3 className="text-sm font-semibold">Transaction History</h3>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-800 text-xs uppercase text-gray-500">
                                <tr>
                                    <th className="px-4 py-2">Product</th>
                                    <th className="px-4 py-2 text-center">Type</th>
                                    <th className="px-4 py-2">Supplier</th>
                                    <th className="px-4 py-2 text-right">Qty</th>
                                    <th className="px-4 py-2 text-right">Rate</th>
                                    <th className="px-4 py-2 text-right">Amount</th>
                                    <th className="px-4 py-2 text-right">Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-zinc-800">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
                                ) : sortedPurchases.map((p: Purchase) => (
                                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-4 py-2 font-medium">{p.product?.product_name}</td>
                                        <td className="px-4 py-2 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(p.purchase_type || '').toLowerCase() === 'sell' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {p.purchase_type || '-'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500">{p.supplier?.supplier_name}</td>
                                        <td className="px-4 py-2 text-right text-gray-600">{p.quantity}</td>
                                        <td className="px-4 py-2 text-right text-gray-600">Rs {p.unit_amount.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right font-medium">Rs {p.total_amount.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                {p.payment_type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="md:hidden divide-y dark:divide-zinc-800">
                        {isLoading ? (
                            <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
                        ) : sortedPurchases.map((p: Purchase) => (
                            <div key={p.id} className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-sm font-medium line-clamp-2 pr-2">{p.product?.product_name}</h4>
                                    <span className="text-sm font-bold whitespace-nowrap">Rs {p.total_amount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                    <span className="truncate max-w-[150px]">{p.supplier?.supplier_name}</span>
                                    <div className="flex items-center gap-2">
                                        <span>{p.quantity} x {p.unit_amount}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(p.purchase_type || '').toLowerCase() === 'sell' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {p.purchase_type || '-'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${p.payment_type === 'Due' ? 'border-red-200 text-red-700 bg-red-50' : 'border-green-200 text-green-700 bg-green-50'}`}>
                                        {p.payment_type}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    )
}
