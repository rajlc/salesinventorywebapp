'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getPurchases, Purchase } from '@/features/purchase/actions/purchase-actions'
import { getSuppliers } from '@/features/suppliers/actions/supplier-actions'
import { getFiscalYears } from '@/features/purchase/actions/purchase-analytics-actions'
import { ArrowLeft, Search, Calendar, Edit2, X } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui-shim'
import PurchaseForm from '@/features/purchase/components/PurchaseForm'

interface PurchaseListContentProps {
    isEmbedded?: boolean
}

export default function PurchaseListContent({ isEmbedded = false }: PurchaseListContentProps) {
    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [supplierId, setSupplierId] = useState('')
    const [fiscalYearId, setFiscalYearId] = useState('')
    const [page, setPage] = useState(1)
    const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null)
    const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null)
    const queryClient = useQueryClient()

    // Date formatter for DD/MM/YYYY
    const formatDateDDMMYYYY = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
    }

    // Date formatter for DD/MM
    const formatDateDDMM = (dateStr: string) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`
    }

    // Fetch Suppliers for filter
    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers-filter'],
        queryFn: () => getSuppliers({ limit: 1000 })
    })

    // Fetch Fiscal Years for filter
    const { data: fiscalYearsData } = useQuery({
        queryKey: ['fiscal-years-filter'],
        queryFn: () => getFiscalYears()
    })

    // Fetch ALL purchases (bypass fiscal year filtering)
    const { data, isLoading } = useQuery({
        queryKey: ['all-purchases', page, search, startDate, endDate, supplierId, fiscalYearId],
        queryFn: () => getPurchases({
            page,
            limit: 50,
            search,
            startDate,
            endDate,
            supplierId,
            fiscalYearId,
            showAll: !fiscalYearId // Only show all if no fiscal year is selected
        })
    })

    const filteredPurchases = data?.purchases || []

    // Group purchases by date
    const groupedPurchases = useMemo(() => {
        const groups: { [key: string]: { purchases: Purchase[], total: number, buyTotal: number, sellTotal: number } } = {}

        filteredPurchases.forEach((purchase: Purchase) => {
            const date = purchase.purchase_date
            if (!groups[date]) {
                groups[date] = { purchases: [], total: 0, buyTotal: 0, sellTotal: 0 }
            }
            groups[date].purchases.push(purchase)
            groups[date].total += purchase.total_amount

            // Calculate Buy/Sell totals
            const type = purchase.purchase_type?.toLowerCase() || ''
            if (type === 'buy') {
                groups[date].buyTotal += purchase.total_amount
            } else if (type === 'sell') {
                groups[date].sellTotal += purchase.total_amount
            }
        })

        // Sort individual purchases in each group (Sell first)
        Object.values(groups).forEach(group => {
            group.purchases.sort((a, b) => {
                const typeA = (a.purchase_type || '').toLowerCase()
                const typeB = (b.purchase_type || '').toLowerCase()
                if (typeA === 'sell' && typeB !== 'sell') return -1
                if (typeA !== 'sell' && typeB === 'sell') return 1
                return 0
            })
        })

        // Sort by date descending
        return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
    }, [filteredPurchases])

    return (
        <div className={`flex flex-col h-full bg-gray-50 dark:bg-zinc-900 ${isEmbedded ? '' : 'md:h-full'}`}>
            {/* Header - Only shown if NOT embedded */}
            {!isEmbedded && (
                <div className="hidden md:flex sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 items-center justify-between shadow-sm">
                    <div>
                        <h1 className="text-[17px] font-bold">Purchase History</h1>
                        <p className="text-[13px] text-gray-500 dark:text-gray-400">View all purchases from all time</p>
                    </div>
                    <Link
                        href="/dashboard/purchase/purchase-entry"
                        className="flex items-center gap-1 px-2 py-1 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Back to Entry
                    </Link>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-2 shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2">

                    {/* Mobile Row 1: Dates */}
                    <div className="flex md:contents w-full gap-2">
                        {/* Date Filters - Mobile: Full width split; Desktop: Auto */}
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Calendar size={14} className="text-gray-400 shrink-0 md:block hidden" />

                            <div className="flex flex-col w-full md:w-auto border dark:border-zinc-700 rounded dark:bg-zinc-800 px-2 py-0.5 relative bg-white dark:bg-zinc-900">
                                <span className="text-[10px] text-gray-500 md:hidden">Start Date</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="text-sm bg-transparent border-none p-0 focus:ring-0 w-full md:w-auto h-5 android-date-input"
                                    placeholder="Start Date"
                                />
                            </div>

                            <span className="text-sm text-gray-500 shrink-0 mt-2 md:mt-0">to</span>

                            <div className="flex flex-col w-full md:w-auto border dark:border-zinc-700 rounded dark:bg-zinc-800 px-2 py-0.5 relative bg-white dark:bg-zinc-900">
                                <span className="text-[10px] text-gray-500 md:hidden">End Date</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="text-sm bg-transparent border-none p-0 focus:ring-0 w-full md:w-auto h-5 android-date-input"
                                    placeholder="End Date"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Mobile Row 2: Supplier, Search, Clear */}
                    <div className="flex md:contents w-full gap-2">
                        {/* Fiscal Year Filter - Hidden on Mobile */}
                        <select
                            value={fiscalYearId}
                            onChange={(e) => setFiscalYearId(e.target.value)}
                            className="hidden md:block px-3 py-1.5 text-sm border dark:border-zinc-700 rounded dark:bg-zinc-800 min-w-[180px]"
                        >
                            <option value="">All Fiscal Years</option>
                            {fiscalYearsData?.data?.map((fy: any) => (
                                <option key={fy.id} value={fy.id}>
                                    {fy.name} {fy.is_active && '(Active)'}
                                </option>
                            ))}
                        </select>

                        {/* Supplier Filter */}
                        <select
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            className="px-3 py-1.5 text-sm border dark:border-zinc-700 rounded dark:bg-zinc-800 w-full md:w-[180px]"
                        >
                            <option value="">All Suppliers</option>
                            {suppliersData?.suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.supplier_name}
                                </option>
                            ))}
                        </select>

                        {/* Search Box */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm border dark:border-zinc-700 rounded focus:ring-1 focus:ring-blue-500 dark:bg-zinc-800"
                            />
                        </div>

                        {/* Clear Filters */}
                        {(search || startDate || endDate || supplierId || fiscalYearId) && (
                            <button
                                onClick={() => {
                                    setSearch('')
                                    setStartDate('')
                                    setEndDate('')
                                    setSupplierId('')
                                    setFiscalYearId('')
                                }}
                                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors shrink-0"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content: All Purchases Table */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Desktop view - Scroll inside Card */}
                <div className="hidden md:flex flex-col flex-1 overflow-hidden p-3">
                    <Card className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-auto relative">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-30 shadow-sm">
                                    <tr className="bg-gray-100 dark:bg-zinc-800 border-b dark:border-zinc-700">
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">S.N</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Date</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Product</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Purchase Type</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Supplier</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Qty</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Rate</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-right bg-gray-100 dark:bg-zinc-800">Total</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Type</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800">Remarks</th>
                                        <th className="px-3 py-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400 text-center bg-gray-100 dark:bg-zinc-800">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {isLoading ? (
                                        <tr><td colSpan={11} className="p-4 text-center text-sm text-gray-500">Loading...</td></tr>
                                    ) : filteredPurchases.length === 0 ? (
                                        <tr><td colSpan={11} className="p-4 text-center text-sm text-gray-500">No purchases found.</td></tr>
                                    ) : (
                                        groupedPurchases.map(([date, group]) => (
                                            <>
                                                {/* Group Header */}
                                                <tr key={`header-${date}`} className="bg-gray-100 dark:bg-zinc-800/80">
                                                    <td colSpan={11} className="px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                        <div className="flex justify-between items-center">
                                                            <span>{date}</span>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-blue-600 font-bold">Buy: NPR {group.buyTotal.toLocaleString()}</span>
                                                                <span className="text-green-600 font-bold">Sell: NPR {group.sellTotal.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Group Items */}
                                                {group.purchases.map((purchase: Purchase, index: number) => {
                                                    // Determine color for Purchase Type
                                                    const pType = purchase.purchase_type || ''
                                                    const pTypeLower = pType.toLowerCase()
                                                    let pTypeClass = 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300'

                                                    if (pTypeLower === 'buy') {
                                                        pTypeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                    } else if (pTypeLower === 'sell') {
                                                        pTypeClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                    }

                                                    return (
                                                        <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                            <td className="px-3 py-2 text-sm text-gray-500 pl-6">{(page - 1) * 50 + index + 1}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-400 opacity-50">"</td>
                                                            <td className="px-3 py-2 text-sm font-medium">{purchase.product?.product_name}</td>
                                                            <td className="px-3 py-2 text-sm">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${pTypeClass}`}>
                                                                    {purchase.purchase_type || '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-sm">{purchase.supplier?.supplier_name}</td>
                                                            <td className="px-3 py-2 text-sm text-right">{purchase.quantity}</td>
                                                            <td className="px-3 py-2 text-sm text-right">{purchase.unit_amount.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-sm text-right font-medium text-green-600">NPR {purchase.total_amount.toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-sm">
                                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${purchase.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                                    }`}>
                                                                    {purchase.payment_type}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-gray-500 truncate max-w-[200px]" title={purchase.remarks}>{purchase.remarks}</td>
                                                            <td className="px-3 py-2 text-center">
                                                                <button
                                                                    onClick={() => setEditingPurchase(purchase)}
                                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded transition-colors"
                                                                    title="Edit Purchase"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination - Fixed at bottom of Card */}
                        {data && data.totalPages > 1 && (
                            <div className="border-t dark:border-zinc-800 px-3 py-2 flex items-center justify-between bg-white dark:bg-zinc-900 shrink-0">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Page {page} of {data.totalPages} ({data.totalCount} total)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 text-sm border dark:border-zinc-700 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                        disabled={page === data.totalPages}
                                        className="px-3 py-1 text-sm border dark:border-zinc-700 rounded disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Mobile Card View - Container Scroll */}
                <div className="md:hidden flex-1 overflow-auto px-3 pt-3 pb-20">
                    {isLoading ? (
                        <div className="text-center p-4 text-gray-500">Loading...</div>
                    ) : filteredPurchases.length === 0 ? (
                        <div className="text-center p-4 text-gray-500">No purchases found.</div>
                    ) : (
                        groupedPurchases.map(([date, group]) => (
                            <div key={`mobile-group-${date}`} className="bg-white dark:bg-zinc-900 rounded-lg border shadow-sm mb-3">
                                {/* Group Header */}
                                <div className="sticky top-0 z-10 rounded-t-lg relative bg-gradient-to-b from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 border-b border-gray-300 dark:border-zinc-700 overflow-hidden shadow-inner">
                                    <style>{`
                                        @keyframes shine {
                                            0% { left: -100%; }
                                            100% { left: 100%; }
                                        }
                                    `}</style>

                                    {/* 3D Top Highlight - Strong White Line */}
                                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-100 z-20"></div>

                                    {/* Header Content */}
                                    <div className="px-3 py-2 flex justify-between items-center relative z-10">
                                        <span className="text-sm font-bold text-gray-800 dark:text-gray-100 drop-shadow-sm">{formatDateDDMMYYYY(date)}</span>
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400 drop-shadow-sm">NPR {group.total.toLocaleString()}</span>
                                    </div>

                                    {/* Moving Neon Light Bottom Border - Vivid Blue Gradient */}
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-300 dark:bg-zinc-800">
                                        <div
                                            className="absolute top-0 bottom-0 w-[50%] bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-90"
                                            style={{ animation: 'shine 2s linear infinite' }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Group Items */}
                                <div className="divide-y dark:divide-zinc-800 bg-white dark:bg-zinc-900 rounded-b-lg overflow-hidden">
                                    {group.purchases.map((purchase: Purchase) => (
                                        <div key={purchase.id} className="p-3 flex flex-col gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                                            {/* Row 1: Product Name (Clickable) */}
                                            <div className="flex justify-between items-start">
                                                <div
                                                    onClick={() => setViewingPurchase(purchase)}
                                                    className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer line-clamp-2 pr-2"
                                                >
                                                    {purchase.product?.product_name}
                                                </div>
                                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${purchase.payment_type === 'Due' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {purchase.payment_type}
                                                </span>
                                            </div>

                                            {/* Row 2: Supplier | Qty */}
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <div className="truncate max-w-[60%]">{purchase.supplier?.supplier_name}</div>
                                                <div>Qty: <span className="font-bold text-gray-900 dark:text-gray-200">{purchase.quantity}</span></div>
                                            </div>

                                            {/* Row 3: Amounts */}
                                            <div className="flex justify-between items-end pt-1">
                                                <div className="text-xs text-gray-400">
                                                    Rate: {purchase.unit_amount.toLocaleString()}
                                                </div>
                                                <div className="font-bold text-xs text-gray-700 dark:text-gray-300">
                                                    NPR {purchase.total_amount.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                    {/* Mobile Pagination */}
                    {data && data.totalPages > 1 && (
                        <div className="flex justify-between items-center pt-4 pb-20">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-xs border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-gray-500">
                                {page} / {data.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                                disabled={page === data.totalPages}
                                className="px-3 py-1.5 text-xs border dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Purchase Modal */}
            {editingPurchase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-3xl h-[80vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden">
                        <PurchaseForm
                            editMode={true}
                            purchaseData={editingPurchase}
                            showExtraFields={true}
                            onClose={() => setEditingPurchase(null)}
                            onSuccess={() => {
                                queryClient.invalidateQueries({ queryKey: ['all-purchases'] })
                                setEditingPurchase(null)
                            }}
                        />
                    </div>
                </div>
            )}

            {/* View Purchase Modal */}
            {
                viewingPurchase && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setViewingPurchase(null)
                            }
                        }}
                    >
                        <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            {/* Header */}
                            <div className="px-4 py-3 border-b dark:border-zinc-800 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                                <h3 className="font-medium text-gray-900 dark:text-gray-100">Purchase Details</h3>
                                <button
                                    onClick={() => setViewingPurchase(null)}
                                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Product</label>
                                    <div className="text-base font-medium text-gray-900 dark:text-gray-100">{viewingPurchase?.product?.product_name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Date</label>
                                        <div className="text-sm">{viewingPurchase?.purchase_date}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Quantity</label>
                                        <div className="text-sm font-semibold">{viewingPurchase?.quantity}</div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Supplier</label>
                                    <div className="text-sm">{viewingPurchase?.supplier?.supplier_name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Rate</label>
                                        <div className="text-sm">{viewingPurchase?.unit_amount?.toLocaleString()}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Total Amount</label>
                                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                                            Rs {viewingPurchase?.total_amount?.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-500 uppercase">Payment Type</label>
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${viewingPurchase?.payment_type === 'Due'
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            }`}>
                                            {viewingPurchase?.payment_type}
                                        </span>
                                    </div>
                                </div>

                                {viewingPurchase?.remarks && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-gray-500 uppercase">Remarks</label>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800 p-2 rounded">
                                            {viewingPurchase?.remarks}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 flex justify-end">
                                <button
                                    onClick={() => {
                                        setEditingPurchase(viewingPurchase)
                                        setViewingPurchase(null)
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <Edit2 size={16} />
                                    Edit Purchase
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}
