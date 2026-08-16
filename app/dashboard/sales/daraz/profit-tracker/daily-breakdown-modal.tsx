'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button
} from '@/components/ui-shim'
import { format } from 'date-fns'
import { Search, Eye, Filter, CheckCircle2, AlertCircle, ShoppingBag, Store } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getDailyOrdersForDate } from '@/features/sales/actions/report-actions'
import { BulkSyncButton } from './bulk-sync-button'

interface DailyBreakdownModalProps {
    dateKey: string | null
    dayStat?: {
        totalProfit: number
        totalRevenue: number
        statsBySeller: Record<string, any>
    }
    isOpen: boolean
    onClose: () => void
    defaultSellerAccount?: string
}

export function DailyBreakdownModal({
    dateKey,
    dayStat,
    isOpen,
    onClose,
    defaultSellerAccount = 'All'
}: DailyBreakdownModalProps) {
    const [search, setSearch] = useState('')
    const [selectedSeller, setSelectedSeller] = useState(defaultSellerAccount)
    const [showUnsyncedOnly, setShowUnsyncedOnly] = useState(false)
    const [activeView, setActiveView] = useState<'stores' | 'orders'>('stores')

    const dateObj = dateKey ? new Date(dateKey) : null
    const formattedDateTitle = dateObj && !isNaN(dateObj.getTime())
        ? format(dateObj, 'MMMM d, yyyy')
        : (dateKey || '')

    const { data: dailyOrderData, isLoading } = useQuery({
        queryKey: ['daily-orders-detail', dateKey, selectedSeller],
        queryFn: async () => {
            if (!dateKey) return null
            return getDailyOrdersForDate({
                dateStr: dateKey,
                sellerAccount: selectedSeller === 'All' ? undefined : selectedSeller
            })
        },
        enabled: isOpen && !!dateKey
    })

    if (!dateKey) return null

    const allOrders = dailyOrderData?.orders || []
    const totalOrderCount = dailyOrderData?.totalCount ?? allOrders.length
    const syncedCount = dailyOrderData?.syncedCount ?? allOrders.filter(o => o.sync_status === 'synced').length
    const unsyncedCount = dailyOrderData?.unsyncedCount ?? (totalOrderCount - syncedCount)
    const allOrderNumbers = allOrders.map(o => o.order_number).filter(Boolean)

    const sellersList = Array.from(new Set(allOrders.map(o => o.seller_account).filter(Boolean)))

    const filteredOrders = allOrders.filter(o => {
        if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase()) && !o.invoice_number?.toLowerCase().includes(search.toLowerCase())) return false
        if (showUnsyncedOnly && o.sync_status === 'synced') return false
        if (selectedSeller !== 'All' && o.seller_account !== selectedSeller) return false
        return true
    })

    const totalProfit = dayStat?.totalProfit || allOrders.reduce((sum, o) => sum + (o.estimated_profit || o.profit || 0), 0)
    const totalRevenue = dayStat?.totalRevenue || allOrders.reduce((sum, o) => sum + (o.total_revenue || 0), 0)

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-w-4xl bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 max-h-[92vh] flex flex-col">
                <DialogHeader className="border-b border-gray-100 dark:border-zinc-800 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <span>Daily Breakdown - {formattedDateTitle}</span>
                            {totalOrderCount > 0 && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
                                    {totalOrderCount} {totalOrderCount === 1 ? 'Order' : 'Orders'}
                                </span>
                            )}
                        </DialogTitle>

                        {/* View Switcher: Stores summary vs Orders detail */}
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setActiveView('stores')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${activeView === 'stores'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <Store className="h-3.5 w-3.5" />
                                Stores ({Object.keys(dayStat?.statsBySeller || {}).length || sellersList.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveView('orders')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${activeView === 'orders'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-2xs font-semibold'
                                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                Orders List ({allOrders.length})
                            </button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-3 space-y-4 flex-1 overflow-y-auto min-h-0">
                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Profit</p>
                            <p className={`text-base font-extrabold mt-1 ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                Rs. {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Revenue</p>
                            <p className="text-base font-extrabold text-gray-900 dark:text-gray-100 mt-1">
                                Rs. {totalRevenue.toLocaleString()}
                            </p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 p-3 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800 flex flex-col justify-between">
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Orders Sync Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                    {syncedCount} Synced
                                </span>
                                {unsyncedCount > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                        {unsyncedCount} Missing
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* View 1: Stores Summary Table */}
                    {activeView === 'stores' && (
                        <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Store Name</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Profit</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Revenue</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {Object.entries(dayStat?.statsBySeller || {}).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                                                No store data found for this day.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        Object.entries(dayStat?.statsBySeller || {}).map(([seller, s]: [string, any]) => (
                                            <TableRow key={seller} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40">
                                                <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-3">
                                                    {seller}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold py-3 ${s.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                    Rs. {(s.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-medium py-3 text-gray-800 dark:text-gray-200">
                                                    Rs. {(s.revenue || 0).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-center py-3">
                                                    {s.missing > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                                            {s.missing} Missing
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                                            Synced
                                                        </span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* View 2: Detailed Orders List */}
                    {activeView === 'orders' && (
                        <div className="space-y-3">
                            {/* Filter Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="relative flex-1 min-w-[180px] max-w-sm">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search order number..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 dark:text-gray-100"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowUnsyncedOnly(!showUnsyncedOnly)}
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors ${showUnsyncedOnly
                                            ? 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        Unsynced Only
                                    </button>

                                    {sellersList.length > 1 && (
                                        <select
                                            value={selectedSeller}
                                            onChange={(e) => setSelectedSeller(e.target.value)}
                                            className="px-2.5 py-1 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-800 dark:text-gray-100 cursor-pointer"
                                        >
                                            <option value="All">All Stores</option>
                                            {sellersList.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-gray-50 dark:bg-zinc-800/60 sticky top-0 z-10">
                                        <TableRow>
                                            <TableHead className="w-10 text-center text-[10px] font-bold uppercase">S.N</TableHead>
                                            <TableHead className="w-20 text-[10px] font-bold uppercase">Status</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase">Order No</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase">Store</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase">Revenue</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase">Cost</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase">Daraz Fee</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase">Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                                                    Loading orders for this day...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredOrders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                                                    No matching orders found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredOrders.map((o: any, idx: number) => {
                                                const isSynced = o.sync_status === 'synced'
                                                return (
                                                    <TableRow key={o.order_primary_id || idx} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/40">
                                                        <TableCell className="text-center text-gray-400 py-2">{idx + 1}</TableCell>
                                                        <TableCell className="py-2">
                                                            {isSynced ? (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                                                    Synced
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                                                    Missing
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-mono font-medium py-2 text-gray-900 dark:text-gray-100">
                                                            {o.order_number}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-gray-600 dark:text-gray-300">
                                                            {o.seller_account || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right py-2 font-medium">
                                                            Rs. {(o.total_revenue || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right py-2 text-gray-600 dark:text-gray-300">
                                                            Rs. {(o.total_purchase_cost || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-right py-2 text-amber-600 dark:text-amber-400 font-medium">
                                                            Rs. {(o.daraz_fees || 0).toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className={`text-right font-bold py-2 ${(o.estimated_profit || o.profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                            Rs. {(o.estimated_profit || o.profit || 0).toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Sync Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Bulk sync will update Daraz finance fees and purchase costs for all {totalOrderCount > 0 ? totalOrderCount : 'available'} orders on this day.
                    </div>
                    <div className="flex items-center gap-2">
                        <BulkSyncButton
                            date={dateKey}
                            orderNumbers={allOrderNumbers}
                            sellerAccount={selectedSeller === 'All' ? undefined : selectedSeller}
                            label={`Bulk Sync Fees (${totalOrderCount > 0 ? totalOrderCount : 'All'})`}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
