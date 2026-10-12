'use client'

import React, { useState, use, useEffect, useMemo, Suspense } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    Loader2,
    Share2,
    Trash2,
    Copy,
    Check,
    MessageSquare,
    Send,
    Calendar,
    Search,
    RotateCcw,
    Receipt,
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { getSupplierFullLedger, createLedgerShare, deleteLedgerComment, addLedgerComment } from '@/features/suppliers/actions/supplier-ledger-actions'
import { Card } from '@/components/ui-shim'
import { useDashboard } from '@/app/dashboard/context'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

// Helper to determine sales/transaction type
function getEntrySalesType(entry: any): string {
    if (entry.particular_detail) {
        return entry.particular_detail // "Due Buy", "Cash Buy", "Due Sell", "Cash Sell"
    }
    if (entry.type === 'transaction') {
        if (Number(entry.debit) > 0) return 'Paid'
        if (Number(entry.credit) > 0) return 'Received'
        return 'Transaction'
    }
    const pType = entry.purchase_type || 'Buy'
    const isCashOrOnline = (entry.payment_type || '').toLowerCase() !== 'due'
    return `${isCashOrOnline ? 'Cash' : 'Due'} ${pType}`
}

// Helper to calculate exact item amount
function getEntryAmount(entry: any): number {
    if (entry.quantity !== undefined && entry.unit_amount !== undefined && Number(entry.quantity) > 0 && Number(entry.unit_amount) > 0) {
        return Number(entry.quantity) * Number(entry.unit_amount)
    }
    if (entry.total_amount !== undefined && Number(entry.total_amount) > 0) {
        return Number(entry.total_amount)
    }
    return Math.max(Number(entry.debit) || 0, Number(entry.credit) || 0)
}

// Helper for type badges
function getSalesTypeBadge(salesType: string) {
    const s = salesType.toLowerCase()
    if (s.includes('due buy') || s === 'due buy') {
        return {
            bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
            dot: 'bg-rose-500'
        }
    }
    if (s.includes('cash buy') || s === 'cash buy') {
        return {
            bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
            dot: 'bg-amber-500'
        }
    }
    if (s.includes('due sell') || s === 'due sell') {
        return {
            bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/60',
            dot: 'bg-sky-500'
        }
    }
    if (s.includes('cash sell') || s === 'cash sell') {
        return {
            bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
            dot: 'bg-emerald-500'
        }
    }
    if (s.includes('paid') || s === 'paid') {
        return {
            bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60',
            dot: 'bg-indigo-500'
        }
    }
    if (s.includes('received') || s === 'received') {
        return {
            bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60',
            dot: 'bg-purple-500'
        }
    }
    return {
        bg: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-gray-400'
    }
}

function SupplierLedgerContent({ supplierId }: { supplierId: string }) {
    const searchParams = useSearchParams()
    const fiscalYearId = searchParams.get('fiscalYearId') || undefined
    const paramSupplierName = searchParams.get('supplierName') ? decodeURIComponent(searchParams.get('supplierName')!) : null
    const { setHeaderTitle } = useDashboard()
    const queryClient = useQueryClient()

    // State
    const [isSharing, setIsSharing] = useState(false)
    const [shareUrl, setShareUrl] = useState<string | null>(null)
    const [copiedFull, setCopiedFull] = useState(false)
    const [copiedRecent, setCopiedRecent] = useState(false)
    const [commentingId, setCommentingId] = useState<string | null>(null)
    const [commentText, setCommentText] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL')

    // Set Global Header Title
    useEffect(() => {
        if (setHeaderTitle && paramSupplierName) {
            setHeaderTitle(`${paramSupplierName} - Ledger`)
        }
        return () => {
            if (setHeaderTitle) setHeaderTitle(null)
        }
    }, [setHeaderTitle, paramSupplierName])

    // Fetch Ledger Data
    const { data: ledgerData, isLoading } = useQuery({
        queryKey: ['supplier-full-ledger', supplierId, fiscalYearId],
        queryFn: () => getSupplierFullLedger({ supplierId, fiscalYearId })
    })

    // Mutations
    const shareMutation = useMutation({
        mutationFn: () => createLedgerShare({ supplierId, fiscalYearId }),
        onSuccess: (res) => {
            if (res.share) {
                const url = `${window.location.hostname === 'localhost' ? 'http://' : 'https://'}${window.location.host}/share/ledger/${res.share.token}`
                setShareUrl(url)
                setIsSharing(true)
            } else {
                toast.error(res.error)
            }
        }
    })

    const deleteCommentMutation = useMutation({
        mutationFn: (id: string) => deleteLedgerComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier-full-ledger'] })
            toast.success('Comment removed.')
        }
    })

    const addCommentMutation = useMutation({
        mutationFn: (data: any) => addLedgerComment(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['supplier-full-ledger'] })
            setCommentingId(null)
            setCommentText('')
            toast.success('Comment added.')
        }
    })

    const ledger = ledgerData?.ledger || []
    const supplierName = ledgerData?.supplierName || paramSupplierName || 'Loading...'
    const runningBalance = ledger.length > 0 ? ledger[0].running_amount : 0

    // Filter ledger entries by search and type
    const filteredLedger = useMemo(() => {
        return ledger.filter((entry: any) => {
            const salesType = getEntrySalesType(entry)

            if (selectedTypeFilter !== 'ALL' && salesType.toLowerCase() !== selectedTypeFilter.toLowerCase()) {
                return false
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchParticular = (entry.particular || '').toLowerCase().includes(q)
                const matchDetail = (entry.particular_detail || '').toLowerCase().includes(q)
                const matchType = salesType.toLowerCase().includes(q)
                if (!matchParticular && !matchDetail && !matchType) return false
            }

            return true
        })
    }, [ledger, selectedTypeFilter, searchQuery])

    // Available sales types in the current ledger with count
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        ledger.forEach((e: any) => {
            const t = getEntrySalesType(e)
            counts[t] = (counts[t] || 0) + 1
        })
        return counts
    }, [ledger])

    // Grouping by Date and Sales Type
    const dateGroups = useMemo(() => {
        const groupsMap = new Map<string, any[]>()

        filteredLedger.forEach(entry => {
            const dateKey = String(entry.date).split('T')[0]
            if (!groupsMap.has(dateKey)) {
                groupsMap.set(dateKey, [])
            }
            groupsMap.get(dateKey)!.push(entry)
        })

        const result: Array<{
            date: string
            formattedDate: string
            dayName: string
            itemCount: number
            totalAmount: number
            totalDebit: number
            totalCredit: number
            endRunningAmount: number
            subgroups: Array<{
                salesType: string
                items: any[]
                totalAmount: number
                totalDebit: number
                totalCredit: number
                subgroupRunningAmount: number
            }>
        }> = []

        groupsMap.forEach((entries, dateKey) => {
            // Group entries within this date by salesType
            const typeMap = new Map<string, any[]>()
            entries.forEach(e => {
                const type = getEntrySalesType(e)
                if (!typeMap.has(type)) {
                    typeMap.set(type, [])
                }
                typeMap.get(type)!.push(e)
            })

            const subgroups: any[] = []
            let dateTotalAmount = 0
            let dateTotalDebit = 0
            let dateTotalCredit = 0

            typeMap.forEach((subItems, salesType) => {
                const subAmount = subItems.reduce((sum, item) => sum + getEntryAmount(item), 0)
                const subDebit = subItems.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)
                const subCredit = subItems.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)

                dateTotalAmount += subAmount
                dateTotalDebit += subDebit
                dateTotalCredit += subCredit

                // Since entries are sorted descending, the first item in the subgroup has the latest running amount
                const subgroupRunningAmount = Number(subItems[0]?.running_amount) || 0

                subgroups.push({
                    salesType,
                    items: subItems,
                    totalAmount: subAmount,
                    totalDebit: subDebit,
                    totalCredit: subCredit,
                    subgroupRunningAmount
                })
            })

            // Format date for display
            const dateObj = new Date(dateKey)
            const formattedDate = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('en-GB')
                : dateKey
            const dayName = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                : dateKey

            result.push({
                date: dateKey,
                formattedDate,
                dayName,
                itemCount: entries.length,
                totalAmount: dateTotalAmount,
                totalDebit: dateTotalDebit,
                totalCredit: dateTotalCredit,
                endRunningAmount: Number(entries[0]?.running_amount) || 0,
                subgroups
            })
        })

        return result
    }, [filteredLedger])

    const copyUrl = (url: string, type: 'full' | 'recent') => {
        if (url) {
            navigator.clipboard.writeText(url)
            if (type === 'full') {
                setCopiedFull(true)
                setTimeout(() => setCopiedFull(false), 2000)
            } else {
                setCopiedRecent(true)
                setTimeout(() => setCopiedRecent(false), 2000)
            }
            toast.success('Link copied to clipboard.')
        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="hidden md:flex sticky top-0 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b dark:border-zinc-800 px-4 py-2.5 items-center justify-between shadow-xs">
                <div className="flex items-center gap-3.5">
                    <Link
                        href={`/dashboard/suppliers/suppliers-account/${supplierId}?fiscalYearId=${fiscalYearId || ''}`}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 transition-colors"
                        title="Back to Supplier Detail"
                    >
                        <ArrowLeft size={19} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {supplierName}
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Ledger History
                            </span>
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Grouped by date and sales transaction type
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-5">
                    <button
                        onClick={() => shareMutation.mutate()}
                        disabled={shareMutation.isPending}
                        className="flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
                    >
                        {shareMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                        Share Ledger
                    </button>

                    <div className="text-right pl-4 border-l dark:border-zinc-800">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">
                            Running Balance
                        </div>
                        <div className={`text-xl font-black ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-2.5 shadow-xs">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/suppliers/suppliers-account/${supplierId}?fiscalYearId=${fiscalYearId || ''}`}
                            className="p-1 rounded-md text-gray-600 dark:text-gray-400"
                        >
                            <ArrowLeft size={18} />
                        </Link>
                        <div>
                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">{supplierName}</div>
                            <div className="text-[10px] text-gray-500">Ledger History</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-500 uppercase font-bold">Running Balance</div>
                        <div className={`text-base font-black ${runningBalance > 1 ? 'text-red-600' : runningBalance < -1 ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                            Rs {runningBalance.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-3.5 md:p-4 space-y-3.5 w-full flex-1">
                {/* 1. Filter & Search Toolbar */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs space-y-3">
                    <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search product, particular, or type..."
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Reset & Totals Overview */}
                        <div className="flex items-center gap-2 self-end md:self-auto text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {(searchQuery || selectedTypeFilter !== 'ALL') && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('')
                                        setSelectedTypeFilter('ALL')
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                >
                                    <RotateCcw size={12} />
                                    Reset
                                </button>
                            )}
                            <div className="px-2.5 py-1 bg-gray-100 dark:bg-zinc-800 rounded-lg font-bold text-gray-700 dark:text-gray-300">
                                {dateGroups.length} Date Groups ({filteredLedger.length} items)
                            </div>
                        </div>
                    </div>

                    {/* Sales Type Pills Filter */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs">
                        <button
                            onClick={() => setSelectedTypeFilter('ALL')}
                            className={`px-3 py-1 rounded-lg font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                selectedTypeFilter === 'ALL'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            All Types ({ledger.length})
                        </button>

                        {Object.entries(typeCounts).map(([type, count]) => {
                            const badge = getSalesTypeBadge(type)
                            const isSelected = selectedTypeFilter.toLowerCase() === type.toLowerCase()
                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedTypeFilter(isSelected ? 'ALL' : type)}
                                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap border transition-all flex items-center gap-1.5 cursor-pointer ${
                                        isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : `${badge.bg} hover:brightness-95`
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                    <span>{type}</span>
                                    <span className="opacity-75 text-[10px]">({count})</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 2. Grouped Content by Date */}
                {isLoading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
                        <Loader2 className="animate-spin text-blue-600" size={24} />
                        <span className="text-sm font-medium text-gray-500">Loading full supplier ledger...</span>
                    </div>
                ) : dateGroups.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
                        <Receipt size={32} className="text-gray-400" />
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No transactions found</p>
                        <p className="text-xs text-gray-400">Try adjusting your filters or date range.</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {dateGroups.map((dateGroup) => (
                            <div
                                key={dateGroup.date}
                                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden transition-all hover:border-gray-300 dark:hover:border-zinc-700"
                            >
                                {/* Date Box Header Bar */}
                                <div className="px-4 py-3 bg-slate-50/90 dark:bg-zinc-850 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                                    {/* Left: Calendar Icon + Date + Day */}
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-800 shrink-0">
                                            <Calendar size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                                                    {dateGroup.formattedDate}
                                                </h3>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                    • {dateGroup.dayName}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                {dateGroup.subgroups.map(sg => {
                                                    const badge = getSalesTypeBadge(sg.salesType)
                                                    return (
                                                        <span
                                                            key={sg.salesType}
                                                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}
                                                        >
                                                            {sg.salesType} ({sg.items.length})
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Date Sums & Running Balance */}
                                    <div className="flex items-center gap-3 sm:gap-4 ml-auto text-right">
                                        <div className="hidden sm:block">
                                            <div className="text-[10px] uppercase font-bold text-gray-400">Total Amount</div>
                                            <div className="text-xs font-black text-gray-800 dark:text-zinc-200">
                                                Rs {dateGroup.totalAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>

                                        {dateGroup.totalDebit > 0 && (
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-red-500">Debit (Sum)</div>
                                                <div className="text-xs font-black text-red-600">
                                                    Rs {dateGroup.totalDebit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        )}

                                        {dateGroup.totalCredit > 0 && (
                                            <div>
                                                <div className="text-[10px] uppercase font-bold text-green-600">Credit (Sum)</div>
                                                <div className="text-xs font-black text-green-600">
                                                    Rs {dateGroup.totalCredit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="pl-3 border-l dark:border-zinc-700">
                                            <div className="text-[10px] uppercase font-bold text-gray-500">Balance</div>
                                            <div className={`text-sm font-black ${dateGroup.endRunningAmount > 1 ? 'text-red-600' : dateGroup.endRunningAmount < -1 ? 'text-green-600' : 'text-gray-900 dark:text-zinc-100'}`}>
                                                Rs {dateGroup.endRunningAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Table inside Date Box (Desktop) */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="hidden md:table-header-group bg-gray-50/70 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 text-[11px] font-bold uppercase text-gray-600 dark:text-gray-400 tracking-wider">
                                            <tr>
                                                <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                                                <th className="px-3.5 py-2.5">Particular</th>
                                                <th className="px-3.5 py-2.5 w-32">Sales Type</th>
                                                <th className="px-3.5 py-2.5 text-right w-36">Amount</th>
                                                <th className="px-3.5 py-2.5 text-right w-36">Debit</th>
                                                <th className="px-3.5 py-2.5 text-right w-36">Credit</th>
                                                <th className="px-3.5 py-2.5 text-right w-40">Running Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                            {dateGroup.subgroups.map((subgroup, sgIdx) => {
                                                const isMultiItem = subgroup.items.length > 1
                                                const badge = getSalesTypeBadge(subgroup.salesType)

                                                return (
                                                    <React.Fragment key={`${dateGroup.date}-${subgroup.salesType}-${sgIdx}`}>
                                                        {/* Subgroup Type Header (if multiple subgroups exist on this date) */}
                                                        {dateGroup.subgroups.length > 1 && (
                                                            <tr className="bg-gray-50/40 dark:bg-zinc-850/40 border-t border-gray-150 dark:border-zinc-800">
                                                                <td colSpan={7} className="px-3.5 py-1.5 text-xs font-bold text-gray-700 dark:text-zinc-300">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                                                                        <span>{subgroup.salesType} Group</span>
                                                                        <span className="text-[11px] text-gray-400 font-normal">
                                                                            ({subgroup.items.length} {subgroup.items.length === 1 ? 'item' : 'items'})
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}

                                                        {/* Individual Rows */}
                                                        {subgroup.items.map((entry, itemIdx) => {
                                                            const isZeroAmount = entry.type === 'purchase' && Number(entry.debit) === 0 && Number(entry.credit) === 0
                                                            const itemAmount = getEntryAmount(entry)
                                                            const itemType = getEntrySalesType(entry)
                                                            const itemBadge = getSalesTypeBadge(itemType)

                                                            return (
                                                                <React.Fragment key={entry.id || itemIdx}>
                                                                    {/* Desktop Row */}
                                                                    <tr className={`hidden md:table-row hover:bg-gray-50/70 dark:hover:bg-zinc-800/40 transition-colors ${isZeroAmount ? 'bg-red-50/60 dark:bg-red-900/15' : ''}`}>
                                                                        {/* # */}
                                                                        <td className="px-3.5 py-2.5 text-xs text-gray-400 text-center font-mono align-top">
                                                                            {itemIdx + 1}
                                                                        </td>

                                                                        {/* Particular */}
                                                                        <td className="px-3.5 py-2.5 text-sm align-top">
                                                                            <div className="flex justify-between items-start gap-2">
                                                                                <div className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                                                                                    {entry.particular}
                                                                                    {entry.quantity !== undefined && entry.quantity > 0 && (
                                                                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                                                            {entry.quantity} × {entry.unit_amount}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                                                    className={`p-1 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0 ${
                                                                                        commentingId === entry.id
                                                                                            ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                                                                                            : entry.comments?.length
                                                                                            ? 'text-blue-500'
                                                                                            : 'text-gray-400 hover:text-gray-600'
                                                                                    }`}
                                                                                    title={entry.comments?.length ? `${entry.comments.length} comments` : "Add note/comment"}
                                                                                >
                                                                                    <MessageSquare size={14} />
                                                                                </button>
                                                                            </div>
                                                                        </td>

                                                                        {/* Sales Type */}
                                                                        <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-md border ${itemBadge.bg}`}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${itemBadge.dot}`} />
                                                                                {itemType}
                                                                            </span>
                                                                        </td>

                                                                        {/* Amount Column (New!) */}
                                                                        <td className="px-3.5 py-2.5 text-sm text-right font-bold text-gray-900 dark:text-zinc-100 align-top whitespace-nowrap">
                                                                            Rs {itemAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                                        </td>

                                                                        {/* Debit */}
                                                                        <td className="px-3.5 py-2.5 text-sm text-right font-bold text-red-600 align-top whitespace-nowrap">
                                                                            {!isMultiItem && Number(entry.debit) > 0 ? (
                                                                                `Rs ${Number(entry.debit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
                                                                            ) : (
                                                                                <span className="text-gray-300 dark:text-zinc-600 font-normal">-</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Credit */}
                                                                        <td className="px-3.5 py-2.5 text-sm text-right font-bold text-green-600 align-top whitespace-nowrap">
                                                                            {!isMultiItem && Number(entry.credit) > 0 ? (
                                                                                `Rs ${Number(entry.credit).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
                                                                            ) : (
                                                                                <span className="text-gray-300 dark:text-zinc-600 font-normal">-</span>
                                                                            )}
                                                                        </td>

                                                                        {/* Running Amount */}
                                                                        <td className={`px-3.5 py-2.5 text-sm text-right font-black align-top whitespace-nowrap ${
                                                                            !isMultiItem
                                                                                ? entry.running_amount > 1
                                                                                    ? 'text-red-600'
                                                                                    : entry.running_amount < -1
                                                                                    ? 'text-green-600'
                                                                                    : 'text-gray-900 dark:text-gray-100'
                                                                                : 'text-gray-300 dark:text-zinc-600 font-normal'
                                                                        }`}>
                                                                            {!isMultiItem ? (
                                                                                `Rs ${Number(entry.running_amount).toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
                                                                            ) : (
                                                                                '-'
                                                                            )}
                                                                        </td>
                                                                    </tr>

                                                                    {/* Mobile Row Card */}
                                                                    <tr className={`md:hidden ${isZeroAmount ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                                                                        <td colSpan={7} className="px-4 py-3 space-y-2 border-b dark:border-zinc-800">
                                                                            <div className="flex justify-between items-start gap-2">
                                                                                <div className="space-y-1 flex-1">
                                                                                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-snug">
                                                                                        {entry.particular}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${itemBadge.bg}`}>
                                                                                            {itemType}
                                                                                        </span>
                                                                                        {entry.quantity !== undefined && entry.quantity > 0 && (
                                                                                            <span className="text-[10px] font-bold text-blue-600">
                                                                                                Qty: {entry.quantity} × {entry.unit_amount}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right shrink-0">
                                                                                    <div className="text-xs font-black text-gray-900 dark:text-white">
                                                                                        Rs {itemAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => setCommentingId(commentingId === entry.id ? null : entry.id)}
                                                                                        className={`mt-1 p-1 rounded ${commentingId === entry.id ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
                                                                                    >
                                                                                        <MessageSquare size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    </tr>

                                                                    {/* Comments Section */}
                                                                    {(commentingId === entry.id || (entry.comments && entry.comments.length > 0)) && (
                                                                        <tr className="bg-gray-50/60 dark:bg-zinc-850/60">
                                                                            <td colSpan={7} className="px-4 py-3">
                                                                                <div className="ml-4 md:ml-10 space-y-2.5">
                                                                                    {entry.comments?.map((c: any) => (
                                                                                        <div key={c.id} className="flex items-start justify-between bg-white dark:bg-zinc-900 p-2.5 rounded-lg border dark:border-zinc-800 shadow-xs">
                                                                                            <div>
                                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${c.author === 'Admin' ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-400'}`}>
                                                                                                        {c.author}
                                                                                                    </span>
                                                                                                    <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                                                                                                </div>
                                                                                                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{c.content}</p>
                                                                                            </div>
                                                                                            <button
                                                                                                onClick={() => deleteCommentMutation.mutate(c.id)}
                                                                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                                                                title="Delete Comment"
                                                                                            >
                                                                                                <Trash2 size={13} />
                                                                                            </button>
                                                                                        </div>
                                                                                    ))}

                                                                                    {commentingId === entry.id && (
                                                                                        <div className="flex gap-2 items-center">
                                                                                            <input
                                                                                                type="text"
                                                                                                value={commentText}
                                                                                                onChange={(e) => setCommentText(e.target.value)}
                                                                                                placeholder="Reply or add note on this item..."
                                                                                                className="flex-1 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-md px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                                                                                autoFocus
                                                                                                onKeyDown={(e) => {
                                                                                                    if (e.key === 'Enter' && commentText.trim()) {
                                                                                                        addCommentMutation.mutate({
                                                                                                            supplierId,
                                                                                                            purchaseId: entry.type === 'purchase' ? entry.id : undefined,
                                                                                                            transactionId: entry.type === 'transaction' ? entry.id : undefined,
                                                                                                            content: commentText,
                                                                                                            author: 'Admin'
                                                                                                        })
                                                                                                    }
                                                                                                }}
                                                                                            />
                                                                                            <button
                                                                                                disabled={addCommentMutation.isPending || !commentText.trim()}
                                                                                                onClick={() => addCommentMutation.mutate({
                                                                                                    supplierId,
                                                                                                    purchaseId: entry.type === 'purchase' ? entry.id : undefined,
                                                                                                    transactionId: entry.type === 'transaction' ? entry.id : undefined,
                                                                                                    content: commentText,
                                                                                                    author: 'Admin'
                                                                                                })}
                                                                                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2 rounded-md transition-colors"
                                                                                            >
                                                                                                {addCommentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        })}

                                                        {/* Subgroup Sum Row (When multi-item: shows sum of amount, sum of debit, sum of credit) */}
                                                        {isMultiItem && (
                                                            <tr className="bg-slate-100/75 dark:bg-zinc-850/90 font-bold border-t border-b border-gray-200 dark:border-zinc-750">
                                                                <td className="px-3.5 py-2.5 text-center text-xs text-gray-500">
                                                                    Σ
                                                                </td>
                                                                <td className="px-3.5 py-2.5 text-xs text-gray-800 dark:text-zinc-200">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span>Total {subgroup.salesType}</span>
                                                                        <span className="text-[11px] font-normal text-gray-500">
                                                                            ({subgroup.items.length} items sum)
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3.5 py-2.5">
                                                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}>
                                                                        {subgroup.salesType}
                                                                    </span>
                                                                </td>
                                                                {/* Amount Sum */}
                                                                <td className="px-3.5 py-2.5 text-sm text-right font-black text-gray-900 dark:text-zinc-100 whitespace-nowrap">
                                                                    Rs {subgroup.totalAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                                </td>
                                                                {/* Debit Sum */}
                                                                <td className="px-3.5 py-2.5 text-sm text-right font-black text-red-600 whitespace-nowrap">
                                                                    {subgroup.totalDebit > 0 ? (
                                                                        `Rs ${subgroup.totalDebit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
                                                                    ) : (
                                                                        <span className="text-gray-400 dark:text-zinc-600 font-normal">-</span>
                                                                    )}
                                                                </td>
                                                                {/* Credit Sum */}
                                                                <td className="px-3.5 py-2.5 text-sm text-right font-black text-green-600 whitespace-nowrap">
                                                                    {subgroup.totalCredit > 0 ? (
                                                                        `Rs ${subgroup.totalCredit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}`
                                                                    ) : (
                                                                        <span className="text-gray-400 dark:text-zinc-600 font-normal">-</span>
                                                                    )}
                                                                </td>
                                                                {/* Running Amount */}
                                                                <td className={`px-3.5 py-2.5 text-sm text-right font-black whitespace-nowrap ${
                                                                    subgroup.subgroupRunningAmount > 1
                                                                        ? 'text-red-600'
                                                                        : subgroup.subgroupRunningAmount < -1
                                                                        ? 'text-green-600'
                                                                        : 'text-gray-900 dark:text-gray-100'
                                                                }`}>
                                                                    Rs {subgroup.subgroupRunningAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            })}

                                            {/* Date Box Final Day Total (If date has multiple subgroups) */}
                                            {dateGroup.subgroups.length > 1 && (
                                                <tr className="bg-blue-50/60 dark:bg-blue-950/25 font-black border-t-2 border-blue-200 dark:border-blue-900/60">
                                                    <td colSpan={3} className="px-3.5 py-2.5 text-xs text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                                                        Total for {dateGroup.formattedDate} ({dateGroup.itemCount} items across {dateGroup.subgroups.length} groups)
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-sm text-right text-blue-950 dark:text-blue-200">
                                                        Rs {dateGroup.totalAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-sm text-right text-red-600">
                                                        {dateGroup.totalDebit > 0 ? `Rs ${dateGroup.totalDebit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-sm text-right text-green-600">
                                                        {dateGroup.totalCredit > 0 ? `Rs ${dateGroup.totalCredit.toLocaleString('en-NP', { minimumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className={`px-3.5 py-2.5 text-sm text-right ${dateGroup.endRunningAmount > 1 ? 'text-red-600' : dateGroup.endRunningAmount < -1 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                        Rs {dateGroup.endRunningAmount.toLocaleString('en-NP', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {isSharing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
                    <Card className="w-full max-w-md p-6 bg-white dark:bg-zinc-900 shadow-2xl space-y-6 rounded-2xl border border-gray-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Shareable Ledger Link</h2>
                            <button onClick={() => setIsSharing(false)} className="text-gray-400 hover:text-gray-500 text-xl font-bold">×</button>
                        </div>

                        <div className="space-y-6">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Copy a link below and send it to <strong>{supplierName}</strong>. They will be able to view their verified ledger.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">1. Full Ledger Link</h3>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-md text-sm text-gray-600 dark:text-gray-400 truncate">
                                            {shareUrl}
                                        </div>
                                        <button
                                            onClick={() => copyUrl(shareUrl as string, 'full')}
                                            className={`px-3 py-2 rounded-md border flex items-center justify-center transition-all ${copiedFull ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700'}`}
                                        >
                                            {copiedFull ? <Check size={18} /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Shows the entire history.</p>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">2. Unsettled Transactions Link</h3>
                                    <div className="flex gap-2">
                                        <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-md text-sm text-gray-600 dark:text-gray-400 truncate">
                                            {shareUrl}?view=recent
                                        </div>
                                        <button
                                            onClick={() => copyUrl(`${shareUrl}?view=recent`, 'recent')}
                                            className={`px-3 py-2 rounded-md border flex items-center justify-center transition-all ${copiedRecent ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-700'}`}
                                        >
                                            {copiedRecent ? <Check size={18} /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Filters out past settled transactions.</p>
                                </div>
                            </div>

                            <p className="text-[10px] text-zinc-400 font-medium">
                                * Links will expire in 30 days for security. Anyone with the link can view the ledger.
                            </p>
                        </div>

                        <button
                            onClick={() => setIsSharing(false)}
                            className="w-full py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black font-bold rounded-lg transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </Card>
                </div>
            )}
        </div>
    )
}

export default function SupplierLedgerPage({ params }: { params: Promise<{ supplierId: string }> }) {
    const { supplierId } = use(params)
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        }>
            <SupplierLedgerContent supplierId={supplierId} />
        </Suspense>
    )
}
