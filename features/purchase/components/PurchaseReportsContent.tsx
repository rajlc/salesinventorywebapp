'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-shim'
import { BarChart3, TrendingUp, ShoppingCart, Package, ArrowLeft, Menu } from 'lucide-react'
import Link from 'next/link'
import { useDashboard } from '@/app/dashboard/context'
import {
    getFiscalYears,
    getActiveFiscalYear,
    getPurchasesByFiscalYear,
    getPurchaseStatsByMonth,
    getPurchasesLast30Days,
    getPurchasesByProduct,
    getTopProductsLast30Days
} from '@/features/purchase/actions/purchase-analytics-actions'

interface PurchaseReportsContentProps {
    isEmbedded?: boolean
}

export default function PurchaseReportsContent({ isEmbedded = false }: PurchaseReportsContentProps) {
    const { setIsMobileMenuOpen } = useDashboard()
    const [selectedFYId, setSelectedFYId] = useState<string>('')

    // Fetch fiscal years
    const { data: fiscalYearsData } = useQuery({
        queryKey: ['fiscal-years'],
        queryFn: () => getFiscalYears()
    })

    // Fetch active fiscal year
    const { data: activeFYData } = useQuery({
        queryKey: ['active-fiscal-year'],
        queryFn: () => getActiveFiscalYear()
    })

    // Set default selected fiscal year to active one
    useEffect(() => {
        if (activeFYData?.data && !selectedFYId) {
            setSelectedFYId(activeFYData.data.id)
        }
    }, [activeFYData, selectedFYId])

    // Fetch purchase stats for selected fiscal year
    const { data: purchaseData, isLoading } = useQuery({
        queryKey: ['purchases-by-fiscal-year', selectedFYId],
        queryFn: () => getPurchasesByFiscalYear(selectedFYId),
        enabled: !!selectedFYId
    })

    // Fetch monthly stats
    const { data: monthlyData } = useQuery({
        queryKey: ['monthly-stats', selectedFYId],
        queryFn: () => getPurchaseStatsByMonth(selectedFYId),
        enabled: !!selectedFYId
    })

    // Fetch last 30 days data
    const { data: last30DaysData } = useQuery({
        queryKey: ['last-30-days'],
        queryFn: () => getPurchasesLast30Days()
    })

    // Fetch product stats (Fiscal Year)
    const { data: productData } = useQuery({
        queryKey: ['products-by-fiscal-year', selectedFYId],
        queryFn: () => getPurchasesByProduct(selectedFYId),
        enabled: !!selectedFYId
    })

    // Fetch top products (30 Days)
    const { data: top30DaysData } = useQuery({
        queryKey: ['top-products-30-days'],
        queryFn: () => getTopProductsLast30Days()
    })

    const fiscalYears = fiscalYearsData?.data || []
    const stats = purchaseData?.stats || { totalPurchases: 0, totalAmount: 0, totalQuantity: 0 }
    const fiscalYear = purchaseData?.fiscalYear
    const monthlyStats = monthlyData?.monthlyStats || []
    const dailyStats = last30DaysData?.dailyStats || []
    const productStats = productData?.productStats || []
    const top30Products = top30DaysData?.productStats || []

    return (
        <div className={`bg-gray-50 dark:bg-zinc-900 ${!isEmbedded ? 'min-h-screen' : 'h-full flex flex-col'}`}>
            <div className={`w-full mx-auto space-y-2 ${!isEmbedded ? 'p-1' : 'p-1 flex-1 overflow-y-auto'}`}>
                {/* Header */}
                <div className={`flex flex-col md:flex-row items-center justify-between gap-2 md:gap-0 ${!isEmbedded ? 'bg-white dark:bg-zinc-900 md:bg-transparent p-2 md:p-0 border-b md:border-0 dark:border-zinc-800 mb-2' : ''}`}>

                    {!isEmbedded && (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                {/* Mobile Menu Button */}
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-md"
                                >
                                    <Menu size={24} />
                                </button>

                                {/* Title */}
                                <div>
                                    <h1 className="text-xl md:text-3xl font-bold">Purchase Analytics</h1>
                                    <p className="text-sm text-gray-500 hidden md:block">Analyze purchases by fiscal year</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fiscal Year Selector & Back Button - Right Aligned */}
                    <div className={`w-full md:w-auto flex items-center gap-2 ${isEmbedded ? 'ml-auto' : 'md:ml-auto'}`}>
                        <div className="relative z-20 w-full md:w-64">
                            <select
                                value={selectedFYId}
                                onChange={(e) => setSelectedFYId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm font-medium"
                            >
                                <option value="">Select Fiscal Year</option>
                                {fiscalYears.map(fy => (
                                    <option key={fy.id} value={fy.id}>
                                        {fy.name} {fy.is_active && '(Active)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Back Button - Right Side */}
                        {!isEmbedded && (
                            <Link href="/dashboard/purchase" className="hidden md:flex p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded text-gray-600 dark:text-gray-300" title="Back to Purchase">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : (
                    <>
                        {/* Summary Stats Row (No Boxes) */}
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg shadow-sm p-4 md:p-6 flex flex-col md:flex-row justify-between divide-y md:divide-y-0 md:divide-x dark:divide-zinc-800 gap-4 md:gap-0">
                            <div className="px-4 text-center flex-1">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Purchases</p>
                                <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2">
                                    {stats.totalPurchases}
                                    <Link href="/dashboard/purchase/all-purchase-list" className="text-xs font-normal text-blue-600 hover:underline translate-y-1">
                                        View all
                                    </Link>
                                </div>
                            </div>
                            <div className="px-4 text-center flex-1 py-4 md:py-0">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Amount</p>
                                <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-500">Rs {stats.totalAmount.toLocaleString()}</div>
                            </div>
                            <div className="px-4 text-center flex-1 py-4 md:py-0">
                                <p className="text-sm text-gray-500 uppercase tracking-wider mb-1">Total Quantity</p>
                                <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-500">{stats.totalQuantity.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Monthly Summary & Daily Purchases */}
                        <div className="space-y-2">
                            {/* Monthly Data Table */}
                            <Card className="overflow-hidden border dark:border-zinc-800">
                                <CardHeader className="py-2 px-4 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
                                    <CardTitle className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4 text-black dark:text-white" />
                                        Monthly Purchase Breakdown
                                    </CardTitle>
                                </CardHeader>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-bold text-black dark:text-white uppercase text-xs">Month</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Purchases</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Qty</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {monthlyStats.length > 0 ? (
                                                monthlyStats.map((stat, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-4 py-2 font-medium text-black dark:text-gray-200">{stat.month}</td>
                                                        <td className="px-4 py-2 text-right text-black dark:text-gray-200">{stat.purchases}</td>
                                                        <td className="px-4 py-2 text-right text-black dark:text-gray-200">{stat.quantity}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-black dark:text-white">Rs {stat.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No monthly data available</td></tr>
                                            )}
                                        </tbody>
                                        {monthlyStats.length > 0 && (
                                            <tfoot className="bg-gray-100 dark:bg-zinc-800 font-bold border-t dark:border-zinc-800">
                                                <tr>
                                                    <td className="px-4 py-2 text-black dark:text-white">Total</td>
                                                    <td className="px-4 py-2 text-right text-black dark:text-white">{stats.totalPurchases}</td>
                                                    <td className="px-4 py-2 text-right text-black dark:text-white">{stats.totalQuantity}</td>
                                                    <td className="px-4 py-2 text-right text-black dark:text-white">Rs {stats.totalAmount.toLocaleString()}</td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </Card>

                            {/* Last 30 Days Daily Table */}
                            <Card className="overflow-hidden border dark:border-zinc-800">
                                <CardHeader className="py-2 px-4 border-b dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/20">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-bold text-black dark:text-white flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-black dark:text-white" />
                                            Last 30 Days - Daily Purchases
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <div className="overflow-x-auto max-h-80 custom-scrollbar">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-800 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-2 text-left font-bold text-black dark:text-white uppercase text-xs">Date</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Purchases</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Qty</th>
                                                <th className="px-4 py-2 text-right font-bold text-black dark:text-white uppercase text-xs">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {dailyStats.length > 0 ? (
                                                dailyStats.slice().reverse().map((stat, i) => (
                                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-4 py-2 text-black dark:text-gray-200">{new Date(stat.date).toLocaleDateString()}</td>
                                                        <td className="px-4 py-2 text-right text-black dark:text-gray-200">{stat.purchases}</td>
                                                        <td className="px-4 py-2 text-right text-black dark:text-gray-200">{stat.quantity}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-black dark:text-white">Rs {stat.amount.toLocaleString()}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-500">No data available for last 30 days</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>

                        {/* Top Products Section - Split View */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                            {/* Left: Top Purchase (30 Days) */}
                            <Card className="overflow-hidden h-full flex flex-col border dark:border-zinc-800">
                                <CardHeader className="py-2 px-4 border-b dark:border-zinc-800 bg-blue-50/50 dark:bg-blue-900/10">
                                    <CardTitle className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                        Top Purchase (30 Days) - By Qty
                                    </CardTitle>
                                </CardHeader>
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-bold text-black dark:text-white uppercase text-[10px] w-8">#</th>
                                                <th className="px-3 py-2 text-left font-bold text-black dark:text-white uppercase text-[10px]">Product</th>
                                                <th className="px-3 py-2 text-right font-bold text-black dark:text-white uppercase text-[10px]">Qty</th>
                                                <th className="px-3 py-2 text-right font-bold text-black dark:text-white uppercase text-[10px]">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {top30Products.length > 0 ? (
                                                top30Products.map((product, index) => (
                                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-3 py-2 text-xs text-black dark:text-gray-400">{index + 1}</td>
                                                        <td className="px-3 py-2 text-xs font-medium text-black dark:text-gray-200 truncate max-w-[150px]" title={product.productName}>
                                                            {product.productName}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-right text-black dark:text-gray-400 font-bold">{product.totalQuantity}</td>
                                                        <td className="px-3 py-2 text-xs text-right font-medium text-black dark:text-white">
                                                            Rs {product.totalAmount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-500 text-xs">No products found</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Right: Top Purchase (Fiscal Year) */}
                            <Card className="overflow-hidden h-full flex flex-col border dark:border-zinc-800">
                                <CardHeader className="py-2 px-4 border-b dark:border-zinc-800 bg-green-50/50 dark:bg-green-900/10">
                                    <CardTitle className="text-sm font-bold text-green-800 dark:text-green-300">
                                        Top Purchase ({fiscalYear?.name || 'Fiscal Year'}) - By Qty
                                    </CardTitle>
                                </CardHeader>
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-800">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-bold text-black dark:text-white uppercase text-[10px] w-8">#</th>
                                                <th className="px-3 py-2 text-left font-bold text-black dark:text-white uppercase text-[10px]">Product</th>
                                                <th className="px-3 py-2 text-right font-bold text-black dark:text-white uppercase text-[10px]">Qty</th>
                                                <th className="px-3 py-2 text-right font-bold text-black dark:text-white uppercase text-[10px]">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {productStats.length > 0 ? (
                                                productStats.map((product, index) => (
                                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                        <td className="px-3 py-2 text-xs text-black dark:text-gray-400">{index + 1}</td>
                                                        <td className="px-3 py-2 text-xs font-medium text-black dark:text-gray-200 truncate max-w-[150px]" title={product.productName}>
                                                            {product.productName}
                                                        </td>
                                                        <td className="px-3 py-2 text-xs text-right text-black dark:text-gray-400 font-bold">{product.totalQuantity}</td>
                                                        <td className="px-3 py-2 text-xs text-right font-medium text-black dark:text-white">
                                                            Rs {product.totalAmount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={4} className="p-8 text-center text-gray-500 text-xs">No products found for this fiscal year</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
