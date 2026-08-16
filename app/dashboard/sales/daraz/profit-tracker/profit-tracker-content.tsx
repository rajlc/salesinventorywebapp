'use client'

import { Fragment, useState, useEffect, useMemo } from 'react'
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui-shim'
import { Search, Eye, AlertTriangle, ClipboardList, LayoutGrid, Calendar, BarChart3, List, FileSpreadsheet, FileText } from 'lucide-react'
import Link from 'next/link'
import { getProfitTrackerData, getDailyProfitStats, getSellerAccounts, getCompleteDateStats } from '@/features/sales/actions/report-actions'
import { format, startOfWeek, endOfWeek, getWeek } from 'date-fns'
import { BulkSyncButton } from './bulk-sync-button'
import { DailyBreakdownModal } from './daily-breakdown-modal'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useFiscalYears, useActiveFiscalYear } from '@/features/settings/hooks/useFiscalYears'
import { fetchDarazPayoutStatus } from '@/features/sales/actions/daraz-finance-service'
import { getStatementBreakdown } from '@/app/dashboard/account/pan-vat-billing/daraz-finance-card'

// Helper component for Limit Selector using props
function LimitSelector({ currentLimit, onLimitChange }: { currentLimit: number, onLimitChange: (limit: number) => void }) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Rows per page</span>
            <select
                value={currentLimit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="h-8 w-16 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            >
                {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                        {size}
                    </option>
                ))}
            </select>
        </div>
    )
}

function WeeklyDetailsModal({ weekRange, onClose }: { weekRange: { start: string, end: string } | null, onClose: () => void }) {
    const [search, setSearch] = useState('')
    const [showUnsyncedOnly, setShowUnsyncedOnly] = useState(false)
    const [seller, setSeller] = useState('All')

    const { data: weekData, isLoading } = useQuery({
        queryKey: ['weekly-orders-detail', weekRange?.start, weekRange?.end],
        queryFn: async () => {
            if (!weekRange) return null
            return getProfitTrackerData({
                page: 1,
                limit: 1000,
                startDate: weekRange.start,
                endDate: weekRange.end
            })
        },
        enabled: !!weekRange
    })

    if (!weekRange) return null

    const allOrders = weekData?.data || []
    const sellers = Array.from(new Set(allOrders.map((o: any) => o.seller_account).filter(Boolean)))

    const filteredOrders = allOrders.filter((o: any) => {
        if (search && !o.order_number?.toLowerCase().includes(search.toLowerCase())) return false
        if (showUnsyncedOnly && o.sync_status === 'synced') return false
        if (seller !== 'All' && o.seller_account !== seller) return false
        return true
    })

    const totalSales = filteredOrders.reduce((sum: number, o: any) => sum + (o.total_revenue || 0), 0)
    const totalPurchaseCost = filteredOrders.reduce((sum: number, o: any) => sum + (o.total_purchase_cost || 0), 0)
    const totalDarazFees = filteredOrders.reduce((sum: number, o: any) => sum + (o.daraz_fees || 0), 0)
    const totalProfit = filteredOrders.reduce((sum: number, o: any) => sum + (o.profit || 0), 0)

    return (
        <Dialog open={!!weekRange} onOpenChange={(open) => { if (!open) onClose() }}>
            <DialogContent className="max-w-5xl bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-2xl p-6 max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                        Weekly Order Details ({weekRange.start} to {weekRange.end})
                    </DialogTitle>
                </DialogHeader>

                {/* Filter Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Order Number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 dark:text-gray-100 shadow-2xs"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowUnsyncedOnly(!showUnsyncedOnly)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${showUnsyncedOnly
                                ? 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                                : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50'
                                }`}
                        >
                            Show Unsynced Only
                        </button>

                        <select
                            value={seller}
                            onChange={(e) => setSeller(e.target.value)}
                            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-800 dark:text-gray-100 cursor-pointer shadow-2xs"
                        >
                            <option value="All">All Sellers</option>
                            {sellers.map((s: any) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-zinc-800 rounded-xl">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-zinc-800/60 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-10 text-center text-[11px] font-bold uppercase">S.N</TableHead>
                                <TableHead className="w-24 text-[11px] font-bold uppercase">Sync Status</TableHead>
                                <TableHead className="w-36 text-[11px] font-bold uppercase">Order Number</TableHead>
                                <TableHead className="text-[11px] font-bold uppercase">Product Name</TableHead>
                                <TableHead className="text-center w-14 text-[11px] font-bold uppercase">Qty</TableHead>
                                <TableHead className="text-right w-24 text-[11px] font-bold uppercase">Sales Amount</TableHead>
                                <TableHead className="text-right w-24 text-[11px] font-bold uppercase">Purchase Cost</TableHead>
                                <TableHead className="text-right w-24 text-[11px] font-bold uppercase">Daraz Fee</TableHead>
                                <TableHead className="text-right w-24 text-[11px] font-bold uppercase">Total Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                        Loading weekly orders...
                                    </TableCell>
                                </TableRow>
                            ) : filteredOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                                        No orders found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders.map((o: any, idx: number) => {
                                    const isSynced = o.sync_status === 'synced'
                                    const extractProductName = (item: any) => {
                                        if (!item) return ''
                                        if (typeof item === 'string') return item
                                        return item.product_name || item.name || item.item_name || item.title || item.seller_sku || ''
                                    }

                                    const itemsArray = (o.products && Array.isArray(o.products) && o.products.length > 0)
                                        ? o.products
                                        : ((o.items_summary && Array.isArray(o.items_summary) && o.items_summary.length > 0) ? o.items_summary : [])

                                    const firstItem = itemsArray[0]
                                    const productName = extractProductName(firstItem) || 'Daraz Product'
                                    const qty = firstItem?.quantity || 1

                                    return (
                                        <TableRow key={o.order_primary_id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40">
                                            <TableCell className="text-center text-gray-400 py-2.5">{idx + 1}</TableCell>
                                            <TableCell className="py-2.5">
                                                {isSynced ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                                        Synced
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                                        Not Synced
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-gray-900 dark:text-gray-100 py-2.5">{o.order_number}</TableCell>
                                            <TableCell className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[240px] py-2.5" title={productName}>
                                                {productName}
                                            </TableCell>
                                            <TableCell className="text-center font-medium text-gray-700 dark:text-gray-300 py-2.5">{qty}</TableCell>
                                            <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100 py-2.5">Rs. {(o.total_revenue || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium text-gray-700 dark:text-gray-300 py-2.5">Rs. {(o.total_purchase_cost || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400 py-2.5">Rs. {(o.daraz_fees || 0).toLocaleString()}</TableCell>
                                            <TableCell className={`text-right font-bold py-2.5 ${(o.profit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                Rs. {(o.profit || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Footer Totals Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <div>
                        <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Total Sales</span>
                        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Rs. {totalSales.toLocaleString()}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Purchase Cost</span>
                        <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">Rs. {totalPurchaseCost.toLocaleString()}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold uppercase text-amber-500 tracking-wider">Daraz Fees</span>
                        <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">Rs. {totalDarazFees.toLocaleString()}</p>
                    </div>
                    <div>
                        <span className="text-[11px] font-bold uppercase text-emerald-500 tracking-wider">Total Profit</span>
                        <p className={`text-sm font-extrabold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                            Rs. {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function ProfitTrackerContent({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const [page, setPage] = useState(() => {
        if (typeof window === 'undefined') return 1
        return Number(searchParams.get('page')) || 1
    })
    const [limit, setLimit] = useState(() => {
        if (typeof window === 'undefined') return 50
        return Number(searchParams.get('limit')) || 50
    })
    const [search, setSearch] = useState(() => {
        if (typeof window === 'undefined') return ''
        return searchParams.get('search') || ''
    })
    const [syncStatus, setSyncStatus] = useState<'all' | 'synced' | 'not_synced'>(() => {
        if (typeof window === 'undefined') return 'all'
        return (searchParams.get('syncStatus') as any) || 'all'
    })
    const [sellerAccount, setSellerAccount] = useState(() => {
        if (typeof window === 'undefined') return 'All'
        return searchParams.get('sellerAccount') || 'All'
    })
    const [activeSubTab, setActiveSubTab] = useState<'orders' | 'accounts' | 'daily' | 'weekly' | 'monthly' | 'report-api'>('orders')
    const [selectedWeekRange, setSelectedWeekRange] = useState<{ start: string, end: string } | null>(null)
    const [selectedDailyDateKey, setSelectedDailyDateKey] = useState<string | null>(null)

    const handleSubTabChange = (tab: 'orders' | 'accounts' | 'daily' | 'weekly' | 'monthly' | 'report-api') => {
        if (tab !== activeSubTab) {
            setSearch('')
            setPage(1)
            setActiveSubTab(tab)
        }
    }

    // Fetch Fiscal Years & Active Fiscal Year for Report By Api
    const { data: fiscalYears = [] } = useFiscalYears()
    const { data: activeFiscalYear } = useActiveFiscalYear()
    const [selectedFYId, setSelectedFYId] = useState<string>('all')

    useEffect(() => {
        if (activeFiscalYear && selectedFYId === 'all') {
            setSelectedFYId(activeFiscalYear.id)
        }
    }, [activeFiscalYear])

    const currentFiscalYear = useMemo(() => {
        if (selectedFYId && selectedFYId !== 'all') {
            return fiscalYears.find(fy => fy.id === selectedFYId) || null
        }
        return activeFiscalYear || fiscalYears.find(fy => fy.is_active) || fiscalYears[0] || null
    }, [selectedFYId, fiscalYears, activeFiscalYear])

    // Query Daraz Payout Status API for "Report By Api" tab
    const { data: payoutData = [], isLoading: isPayoutLoading } = useQuery({
        queryKey: ['daraz-payout-status-api-tracker'],
        queryFn: async () => {
            return fetchDarazPayoutStatus('All')
        },
        enabled: activeSubTab === 'report-api',
        staleTime: 0,
    })

    // Filter Payout Statements by Selected Fiscal Year Date Range
    const filteredPayoutData = useMemo(() => {
        if (!payoutData || payoutData.length === 0) return []
        if (!currentFiscalYear || !currentFiscalYear.start_date || !currentFiscalYear.end_date) {
            return payoutData
        }

        const fyStart = new Date(currentFiscalYear.start_date).getTime()
        const fyEnd = new Date(currentFiscalYear.end_date + 'T23:59:59').getTime()

        return payoutData.filter((item: any) => {
            const rawStr = (item.created_at || item.statement || '').trim()
            if (!rawStr) return true

            let t = 0
            if (rawStr.includes(' - ')) {
                // Range format: "03 Aug 2026 - 09 Aug 2026"
                const parts = rawStr.split(' - ')
                const d = new Date(parts[0].trim())
                if (!isNaN(d.getTime())) t = d.getTime()
            } else {
                // ISO / SQL format: "2026-08-10 00:23:07" or "2026-08-10"
                const d = new Date(rawStr)
                if (!isNaN(d.getTime())) t = d.getTime()
            }

            if (t === 0) return true
            return t >= fyStart && t <= fyEnd
        })
    }, [payoutData, currentFiscalYear])

    const [availableSellers, setAvailableSellers] = useState<string[]>([])

    useEffect(() => {
        getSellerAccounts().then(setAvailableSellers)
    }, [])

    useEffect(() => {
        if (!isEmbedded) {
            const params = new URLSearchParams(searchParams.toString())

            let changed = false
            const updateParam = (key: string, val: string, defaultVal: string) => {
                const current = params.get(key) || defaultVal
                if (current !== val) {
                    if (val === defaultVal) params.delete(key)
                    else params.set(key, val)
                    changed = true
                }
            }

            updateParam('page', String(page), '1')
            updateParam('limit', String(limit), '50')
            updateParam('search', search, '')
            updateParam('syncStatus', syncStatus, 'all')
            updateParam('sellerAccount', sellerAccount, 'All')

            if (changed) {
                const str = params.toString()
                const url = str ? `${pathname}?${str}` : pathname
                router.replace(url, { scroll: false })
            }
        }
    }, [page, limit, search, syncStatus, sellerAccount, isEmbedded, router, pathname, searchParams])

    const { data: profitData, isLoading: isOrdersLoading, error: ordersError } = useQuery({
        queryKey: ['profit-tracker', page, limit, search, syncStatus, sellerAccount],
        queryFn: async () => {
            try {
                const result = await getProfitTrackerData({
                    page,
                    limit,
                    search,
                    syncStatus,
                    sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
                    startDate: undefined,
                    endDate: undefined
                })
                return result
            } catch (err) {
                console.error('[PROFIT TRACKER] Fetch Error:', err)
                throw err
            }
        },
        placeholderData: keepPreviousData
    })

    const { data: completeDateStats } = useQuery({
        queryKey: ['complete-date-stats', search, syncStatus, sellerAccount],
        queryFn: async () => {
            try {
                return await getCompleteDateStats({
                    page: 1,
                    limit: 100,
                    search,
                    syncStatus,
                    sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
                    startDate: undefined,
                    endDate: undefined
                });
            } catch (err) {
                console.error('[PROFIT TRACKER] Complete date stats fetch error:', err);
                return {};
            }
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData
    });

    const { data: dailyStats } = useQuery({
        queryKey: ['daily-profit-stats', search, syncStatus, sellerAccount],
        queryFn: async () => {
            return getDailyProfitStats({
                search,
                syncStatus,
                sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
                startDate: undefined,
                endDate: undefined
            })
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: keepPreviousData
    })

    const orders = profitData?.data || []
    const totalCount = profitData?.totalCount || 0
    const totalPages = profitData?.totalPages || 0
    const rawStatsList: any[] = Array.isArray(dailyStats) ? dailyStats : []
    const isLoading = isOrdersLoading

    const stats: any = completeDateStats ? JSON.parse(JSON.stringify(completeDateStats)) : {};

    if (Object.keys(stats).length === 0) {
        if (rawStatsList.length === 0 && orders.length > 0) {
            orders.forEach((order: any) => {
                if (!order.delivered_by_daraz && !order.delivered_at) return

                const dateRaw = order.delivered_by_daraz || order.delivered_at
                const dateKey = format(new Date(dateRaw), 'yyyy-MM-dd')

                if (!stats[dateKey]) {
                    stats[dateKey] = { statsBySeller: {}, totalProfit: 0, totalRevenue: 0, orderNumbers: [] }
                }

                if (order.order_number) {
                    stats[dateKey].orderNumbers.push(order.order_number)
                }

                const seller = order.seller_account || 'Unknown'
                if (!stats[dateKey].statsBySeller[seller]) {
                    stats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0, count: 0 }
                }

                const orderProfit = order.profit || 0
                const orderRevenue = order.total_revenue || 0
                const orderCost = order.total_purchase_cost || 0
                const isMissing = orderCost <= 0

                stats[dateKey].totalProfit += orderProfit
                stats[dateKey].totalRevenue += orderRevenue
                stats[dateKey].statsBySeller[seller].profit += orderProfit
                stats[dateKey].statsBySeller[seller].revenue += orderRevenue
                stats[dateKey].statsBySeller[seller].cost += orderCost
                stats[dateKey].statsBySeller[seller].count += 1
                if (isMissing) {
                    stats[dateKey].statsBySeller[seller].missing += 1
                }
            })
        } else {
            rawStatsList.forEach((stat: any) => {
                if (!stat.date) return
                const dateKey = format(new Date(stat.date), 'yyyy-MM-dd')

                if (!stats[dateKey]) {
                    stats[dateKey] = { statsBySeller: {}, totalProfit: 0, totalRevenue: 0 }
                }

                const seller = stat.seller || 'Unknown'
                if (!stats[dateKey].statsBySeller[seller]) {
                    stats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0, count: 0 }
                }

                stats[dateKey].totalProfit += stat.profit
                stats[dateKey].totalRevenue += (stat.revenue || 0)
                stats[dateKey].statsBySeller[seller].profit += stat.profit
                stats[dateKey].statsBySeller[seller].revenue += (stat.revenue || 0)
                stats[dateKey].statsBySeller[seller].cost += (stat.cost || 0)
                stats[dateKey].statsBySeller[seller].missing += stat.missing
                stats[dateKey].statsBySeller[seller].count += (stat.count || 1)
            })
        }
    }

    // Grouping Logic
    const groupedOrders = orders.reduce((groups: any, order: any) => {
        const dateRaw = order.delivered_by_daraz || order.delivered_at
        const dateKey = dateRaw ? format(new Date(dateRaw), 'yyyy-MM-dd') : 'Unknown Date'

        if (!groups[dateKey]) {
            const dayStats = stats[dateKey] || { statsBySeller: {}, totalProfit: 0 }

            groups[dateKey] = {
                orders: [],
                totalProfit: dayStats.totalProfit || 0,
                totalRevenue: dayStats.totalRevenue || 0,
                dateLabel: dateRaw ? format(new Date(dateRaw), 'EEEE, MMM d') : 'Unknown Date',
                statsBySeller: dayStats.statsBySeller || {}
            }
        }
        groups[dateKey].orders.push(order)
        return groups
    }, {})

    const monthlyMap: Record<string, { 
        totalProfit: number, 
        totalRevenue: number, 
        totalCost: number,
        totalOrders: number,
        totalUnsynced: number,
        statsBySeller: Record<string, { profit: number, revenue: number, cost: number, count: number, missing: number }> 
    }> = {};

    Object.keys(stats).forEach(date => {
        const monthKey = date.substring(0, 7);
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = {
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalOrders: 0,
                totalUnsynced: 0,
                statsBySeller: {}
            };
        }

        const dayStat = stats[date];
        monthlyMap[monthKey].totalProfit += (dayStat.totalProfit || 0);
        monthlyMap[monthKey].totalRevenue += (dayStat.totalRevenue || 0);

        Object.entries(dayStat.statsBySeller || {}).forEach(([seller, s]: [string, any]) => {
            if (!monthlyMap[monthKey].statsBySeller[seller]) {
                monthlyMap[monthKey].statsBySeller[seller] = { profit: 0, revenue: 0, cost: 0, count: 0, missing: 0 };
            }
            monthlyMap[monthKey].statsBySeller[seller].profit += (s.profit || 0);
            monthlyMap[monthKey].statsBySeller[seller].revenue += (s.revenue || 0);
            monthlyMap[monthKey].statsBySeller[seller].cost += (s.cost || 0);
            monthlyMap[monthKey].statsBySeller[seller].missing += (s.missing || 0);
            monthlyMap[monthKey].statsBySeller[seller].count += (s.count || 0);

            monthlyMap[monthKey].totalCost += (s.cost || 0);
            monthlyMap[monthKey].totalOrders += (s.count || 0);
            monthlyMap[monthKey].totalUnsynced += (s.missing || 0);
        });
    });

    const sortedMonthlyKeys = Object.keys(monthlyMap).sort((a, b) => b.localeCompare(a));

    const weeklyMap: Record<string, { 
        start: Date, 
        end: Date, 
        weekNum: number,
        totalProfit: number, 
        totalRevenue: number, 
        totalCost: number,
        totalOrders: number,
        totalUnsynced: number,
        statsBySeller: Record<string, { profit: number, revenue: number, cost: number, count: number, missing: number }> 
    }> = {};

    Object.keys(stats).forEach(date => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return;

        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        const key = format(start, 'yyyy-MM-dd');
        const weekNum = getWeek(d, { weekStartsOn: 1 });

        if (!weeklyMap[key]) {
            weeklyMap[key] = {
                start,
                end,
                weekNum,
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalOrders: 0,
                totalUnsynced: 0,
                statsBySeller: {}
            };
        }

        const dayStat = stats[date];
        weeklyMap[key].totalProfit += (dayStat.totalProfit || 0);
        weeklyMap[key].totalRevenue += (dayStat.totalRevenue || 0);

        Object.entries(dayStat.statsBySeller || {}).forEach(([seller, s]: [string, any]) => {
            if (!weeklyMap[key].statsBySeller[seller]) {
                weeklyMap[key].statsBySeller[seller] = { profit: 0, revenue: 0, cost: 0, count: 0, missing: 0 };
            }
            weeklyMap[key].statsBySeller[seller].profit += (s.profit || 0);
            weeklyMap[key].statsBySeller[seller].revenue += (s.revenue || 0);
            weeklyMap[key].statsBySeller[seller].cost += (s.cost || 0);
            weeklyMap[key].statsBySeller[seller].missing += (s.missing || 0);
            weeklyMap[key].statsBySeller[seller].count += (s.count || 0);

            weeklyMap[key].totalCost += (s.cost || 0);
            weeklyMap[key].totalOrders += (s.count || 0);
            weeklyMap[key].totalUnsynced += (s.missing || 0);
        });
    });

    const sortedWeeklyKeys = Object.keys(weeklyMap).sort((a, b) => b.localeCompare(a));

    // Combine Report (Payout Statements) & Profit Tracker (Weekly Profit Details) by Week Range & Store for "Report By Api"
    const apiReportWeeklyData = useMemo(() => {
        if (activeSubTab !== 'report-api') return { sortedKeys: [], map: {}, totals: { orders: 0, receivable: 0, cost: 0, returned: 0, profit: 0 } }

        const map: Record<string, {
            weekLabel: string
            weekNum: number
            start: Date
            end: Date
            totalOrders: number
            totalReceivable: number
            totalCost: number
            totalReturned: number
            totalProfit: number
            stores: Record<string, { storeName: string, count: number, receivable: number, cost: number, returned: number, profit: number }>
        }> = {};

        const STORE_MAP: Record<string, string> = {
            'npdznlue6t': 'Bagmati Traders',
            'npdznmnap2': 'BTAS',
            'npdznmij3v': 'Balaju Shop',
            'npdzncosm': 'Cosmetic Shop',
            'bagmati traders': 'Bagmati Traders',
            'btas': 'BTAS',
            'balaju shop': 'Balaju Shop',
            'cosmetic shop': 'Cosmetic Shop'
        };

        // 1. Process Payout Statements for the selected Fiscal Year
        (filteredPayoutData || []).forEach((item: any) => {
            const rawPeriod = (item.statement || item.created_at || '').trim()
            let startDate: Date | null = null
            let endDate: Date | null = null

            if (rawPeriod.includes(' - ')) {
                const parts = rawPeriod.split(' - ')
                const d1 = new Date(parts[0].trim())
                const d2 = new Date(parts[1].trim())
                if (!isNaN(d1.getTime())) startDate = d1
                if (!isNaN(d2.getTime())) endDate = d2
            } else if (rawPeriod) {
                const d = new Date(rawPeriod)
                if (!isNaN(d.getTime())) {
                    // Daraz statements are generated on Monday for the preceding Monday-to-Sunday cycle
                    const endSun = new Date(d)
                    endSun.setDate(d.getDate() - 1)
                    const startMon = new Date(endSun)
                    startMon.setDate(endSun.getDate() - 6)
                    startDate = startMon
                    endDate = endSun
                }
            }

            if (!startDate) startDate = new Date()
            const weekStart = startOfWeek(startDate, { weekStartsOn: 1 })
            const weekEnd = endDate || endOfWeek(startDate, { weekStartsOn: 1 })
            const weekKey = format(weekStart, 'yyyy-MM-dd')
            const weekNum = getWeek(weekStart, { weekStartsOn: 1 })

            if (!map[weekKey]) {
                map[weekKey] = {
                    weekLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
                    weekNum,
                    start: weekStart,
                    end: weekEnd,
                    totalOrders: 0,
                    totalReceivable: 0,
                    totalCost: 0,
                    totalReturned: 0,
                    totalProfit: 0,
                    stores: {}
                }
            }

            const { netClosingCalc, returnedAmt } = getStatementBreakdown(item)

            const rawStore = (item.store_name || item.seller_account || (item.statement_number ? item.statement_number.split('-')[0] : '') || '').toLowerCase()
            const storeLabel = STORE_MAP[rawStore] || item.store_name || item.seller_account || 'Bagmati Traders'

            if (!map[weekKey].stores[storeLabel]) {
                map[weekKey].stores[storeLabel] = {
                    storeName: storeLabel,
                    count: 0,
                    receivable: 0,
                    cost: 0,
                    returned: 0,
                    profit: 0
                }
            }

            map[weekKey].stores[storeLabel].receivable += netClosingCalc
            map[weekKey].stores[storeLabel].returned += returnedAmt
            map[weekKey].totalReceivable += netClosingCalc
            map[weekKey].totalReturned += returnedAmt
        })

        // 2. Merge order count and purchase cost from weeklyMap (within FY)
        const fyStart = currentFiscalYear?.start_date ? new Date(currentFiscalYear.start_date).getTime() : 0
        const fyEnd = currentFiscalYear?.end_date ? new Date(currentFiscalYear.end_date + 'T23:59:59').getTime() : Infinity

        Object.keys(weeklyMap).forEach((wKey) => {
            const w = weeklyMap[wKey]
            const wTime = w.start.getTime()
            if (fyStart && (wTime < fyStart || wTime > fyEnd)) return

            if (!map[wKey]) {
                map[wKey] = {
                    weekLabel: `${format(w.start, 'MMM d')} - ${format(w.end, 'MMM d, yyyy')}`,
                    weekNum: w.weekNum,
                    start: w.start,
                    end: w.end,
                    totalOrders: 0,
                    totalReceivable: 0,
                    totalCost: 0,
                    totalReturned: 0,
                    totalProfit: 0,
                    stores: {}
                }
            }

            map[wKey].totalOrders += w.totalOrders
            map[wKey].totalCost += w.totalCost

            Object.entries(w.statsBySeller || {}).forEach(([seller, s]: [string, any]) => {
                const mappedSeller = STORE_MAP[seller.toLowerCase()] || seller
                if (!map[wKey].stores[mappedSeller]) {
                    map[wKey].stores[mappedSeller] = {
                        storeName: mappedSeller,
                        count: 0,
                        receivable: 0,
                        cost: 0,
                        returned: 0,
                        profit: 0
                    }
                }
                map[wKey].stores[mappedSeller].count += (s.count || 0)
                map[wKey].stores[mappedSeller].cost += (s.cost || 0)
            })
        })

        // 3. Compute profit for each store and week summary (Profit = Receivable Amount - Purchase Cost)
        let grandOrders = 0
        let grandReceivable = 0
        let grandCost = 0
        let grandReturned = 0
        let grandProfit = 0

        const sortedKeys = Object.keys(map).sort((a, b) => b.localeCompare(a))

        sortedKeys.forEach(wKey => {
            const w = map[wKey]
            w.totalProfit = w.totalReceivable - w.totalCost

            Object.keys(w.stores).forEach(sKey => {
                const st = w.stores[sKey]
                st.profit = st.receivable - st.cost
            })

            grandOrders += w.totalOrders
            grandReceivable += w.totalReceivable
            grandCost += w.totalCost
            grandReturned += w.totalReturned
            grandProfit += w.totalProfit
        })

        return {
            sortedKeys,
            map,
            totals: {
                orders: grandOrders,
                receivable: Math.round(grandReceivable * 100) / 100,
                cost: Math.round(grandCost * 100) / 100,
                returned: Math.round(grandReturned * 100) / 100,
                profit: Math.round(grandProfit * 100) / 100
            }
        }
    }, [activeSubTab, filteredPayoutData, weeklyMap, currentFiscalYear])

    const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => {
        if (a === 'Unknown Date') return 1
        if (b === 'Unknown Date') return -1
        return b.localeCompare(a)
    })

    const visibleOrderNumbers = orders.map((o: any) => o.order_number).filter(Boolean)

    return (
        <div className="flex flex-col min-h-full bg-gray-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg">
            {ordersError && (
                <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Action Failed</p>
                        <p className="text-xs">{(ordersError as any)?.message || 'Something went wrong while fetching profit data.'}</p>
                    </div>
                </div>
            )}

            {/* Header & Controls Bar */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 py-3 md:px-6 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-gray-100/90 dark:bg-zinc-800/90 p-1 rounded-xl border border-gray-200/80 dark:border-zinc-700/80">
                            <button
                                onClick={() => handleSubTabChange('orders')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'orders'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>Orders Details</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('accounts')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'accounts'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span>Account Details</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('daily')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'daily'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                <span>Daily Details</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('weekly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'weekly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                <span>Weekly Details</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('monthly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'monthly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <List className="h-3.5 w-3.5" />
                                <span>Monthly Details</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('report-api')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${activeSubTab === 'report-api'
                                    ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-medium'
                                    }`}
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                <span>Report By Api</span>
                            </button>
                        </div>

                        {activeSubTab === 'orders' && (
                            <div className="relative w-full sm:w-60">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search Orders..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value)
                                        setPage(1)
                                    }}
                                    className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 dark:text-gray-100 shadow-2xs"
                                />
                            </div>
                        )}
                    </div>

                    {activeSubTab === 'orders' && (
                        <div className="flex flex-wrap items-center gap-2.5">
                            <BulkSyncButton orderNumbers={visibleOrderNumbers} />

                            <select
                                value={syncStatus}
                                onChange={(e) => {
                                    setSyncStatus(e.target.value as any)
                                    setPage(1)
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-800 dark:text-gray-100 cursor-pointer shadow-2xs"
                            >
                                <option value="all">All</option>
                                <option value="synced">Synced (Cost Found)</option>
                                <option value="not_synced">Not Synced (Missing Cost)</option>
                            </select>

                            <select
                                value={sellerAccount}
                                onChange={(e) => {
                                    setSellerAccount(e.target.value)
                                    setPage(1)
                                }}
                                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-800 dark:text-gray-100 cursor-pointer shadow-2xs"
                            >
                                <option value="All">All Seller Accounts</option>
                                {availableSellers.map(seller => (
                                    <option key={seller} value={seller}>{seller}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Table Area */}
            <div className="p-4 md:p-6 space-y-4">
                {/* 1. ORDERS DETAILS VIEW */}
                {activeSubTab === 'orders' && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                <TableRow>
                                    <TableHead className="w-10 text-center text-[11px] font-bold uppercase">S.N</TableHead>
                                    <TableHead className="w-24 text-[11px] font-bold uppercase">Sync Status</TableHead>
                                    <TableHead className="w-28 text-[11px] font-bold uppercase">Delivered Date</TableHead>
                                    <TableHead className="w-36 text-[11px] font-bold uppercase">Order Number</TableHead>
                                    <TableHead className="w-32 text-[11px] font-bold uppercase">Seller Account</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase">Product Name</TableHead>
                                    <TableHead className="text-right w-28 text-[11px] font-bold uppercase">Product Price</TableHead>
                                    <TableHead className="text-right w-28 text-[11px] font-bold uppercase">Purchase Cost</TableHead>
                                    <TableHead className="text-right w-28 text-[11px] font-bold uppercase">Profit</TableHead>
                                    <TableHead className="text-center w-16 text-[11px] font-bold uppercase">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                            Loading orders...
                                        </TableCell>
                                    </TableRow>
                                ) : sortedDateKeys.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                                            No orders found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedDateKeys.map((dateKey) => {
                                        const group = groupedOrders[dateKey]
                                        return (
                                            <Fragment key={dateKey}>
                                                <TableRow className="bg-gray-100/90 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
                                                    <TableCell colSpan={3} className="py-2.5 pl-4 align-middle border-r border-gray-200 dark:border-zinc-700/50">
                                                        <span className="font-bold text-gray-800 dark:text-gray-200 text-xs whitespace-nowrap">
                                                            {group.dateLabel}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell colSpan={5} className="py-2.5 px-4 align-middle">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {Object.entries(group.statsBySeller || {}).map(([seller, sellerStats]: [string, any]) => {
                                                                const sProfit = sellerStats.profit || 0
                                                                const sRevenue = sellerStats.revenue || 0
                                                                const sCost = sellerStats.cost || 0
                                                                const sMissing = sellerStats.missing || 0

                                                                return (
                                                                    <div key={seller} className="flex items-center gap-1.5 text-[11px] bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-gray-200/80 dark:border-zinc-700 shadow-2xs font-medium">
                                                                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[110px]" title={seller}>
                                                                            {seller}
                                                                        </span>
                                                                        <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                        <span className="text-gray-500">
                                                                            Profit: <strong className={`font-bold ${sProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>Rs. {sProfit.toLocaleString()}</strong>
                                                                        </span>
                                                                        <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                        <span className="text-gray-500">
                                                                            Total: <strong className="font-semibold text-gray-700 dark:text-gray-300">Rs. {sRevenue.toLocaleString()}</strong>
                                                                        </span>
                                                                        <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                        <span className="text-gray-500">
                                                                            Cost: <strong className="font-semibold text-gray-700 dark:text-gray-300">Rs. {sCost.toLocaleString()}</strong>
                                                                        </span>
                                                                        {sMissing > 0 && (
                                                                            <>
                                                                                <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                                                                    <AlertTriangle className="h-3 w-3 text-rose-500" />
                                                                                    {sMissing} Missing
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell colSpan={2} className="py-2.5 pr-4 align-middle text-right">
                                                        <span className="text-gray-500 text-xs font-semibold">TP: </span>
                                                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                                                            Rs. {(group.totalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>

                                                {group.orders.map((o: any, idx: number) => {
                                                    const cost = o.total_purchase_cost || 0
                                                    const profit = o.profit || 0
                                                    const revenue = o.total_revenue || 0
                                                    const profitPct = o.profit_percentage || (revenue > 0 ? (profit / revenue) * 100 : 0)
                                                    const isSynced = o.sync_status === 'synced'

                                                    const deliveredDateRaw = o.delivered_by_daraz || o.delivered_at
                                                    const deliveredDateStr = deliveredDateRaw ? format(new Date(deliveredDateRaw), 'MM/dd/yyyy') : '-'
                                                    const deliveredTimeStr = deliveredDateRaw ? format(new Date(deliveredDateRaw), 'hh:mm a') : ''

                                                    const extractProductName = (item: any) => {
                                                        if (!item) return ''
                                                        if (typeof item === 'string') return item
                                                        return item.product_name || item.name || item.item_name || item.title || item.seller_sku || ''
                                                    }

                                                    const itemsArray = (o.products && Array.isArray(o.products) && o.products.length > 0)
                                                        ? o.products
                                                        : ((o.items_summary && Array.isArray(o.items_summary) && o.items_summary.length > 0) ? o.items_summary : [])

                                                    const firstItem = itemsArray[0]
                                                    const firstProductName = extractProductName(firstItem) || 'Daraz Product'
                                                    const productId = firstItem?.product_id || firstItem?.id || 'N/A'
                                                    const extraItemsCount = itemsArray.length > 1 ? itemsArray.length - 1 : 0
                                                    const rowSNIndex = (page - 1) * limit + idx + 1

                                                    const formatInvoiceNumber = (inv: string | null) => {
                                                        if (!inv) return 'Inv N/A'
                                                        const cleanInv = inv.replace(/^(Inv\s*)+/i, '')
                                                        return `Inv ${cleanInv}`
                                                    }

                                                    return (
                                                        <TableRow key={o.order_primary_id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-xs">
                                                            <TableCell className="text-center font-medium text-gray-400 py-3">{rowSNIndex}</TableCell>

                                                            <TableCell className="py-3">
                                                                {isSynced ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                                                        Synced
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                                                        Not Synced
                                                                    </span>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col font-medium text-gray-900 dark:text-gray-100">
                                                                    <span>{deliveredDateStr}</span>
                                                                    <span className="text-[11px] text-gray-400">{deliveredTimeStr}</span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="py-3">
                                                                <div className="flex flex-col">
                                                                    <Link
                                                                        href={`/dashboard/sales/daraz/profit-tracker/${o.order_primary_id}`}
                                                                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline font-mono"
                                                                    >
                                                                        {o.order_number}
                                                                    </Link>
                                                                    <span className="text-[11px] text-gray-400">
                                                                        {formatInvoiceNumber(o.invoice_number)}
                                                                    </span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="font-semibold text-gray-800 dark:text-gray-200 py-3">
                                                                {o.seller_account || 'Unknown'}
                                                            </TableCell>

                                                            <TableCell className="py-3 max-w-[280px]">
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={firstProductName}>
                                                                        {firstProductName}
                                                                    </span>
                                                                    <span className="text-[11px] text-gray-400">
                                                                        ID: {productId}
                                                                    </span>
                                                                    {extraItemsCount > 0 && (
                                                                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                                                                            (+{extraItemsCount} more)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100 py-3">
                                                                Rs. {revenue.toLocaleString()}
                                                            </TableCell>

                                                            <TableCell className="text-right font-semibold text-purple-600 dark:text-purple-400 py-3">
                                                                Rs. {cost.toLocaleString()}
                                                            </TableCell>

                                                            <TableCell className="text-right py-3">
                                                                {!isSynced ? (
                                                                    <span className="font-semibold text-rose-500">Not Synced</span>
                                                                ) : (
                                                                    <div className="flex flex-col items-end">
                                                                        <span className={`font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                                            Rs. {profit.toLocaleString()}
                                                                        </span>
                                                                        <span className={`text-[11px] ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                                            ({profitPct.toFixed(2)}%)
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="text-center py-3">
                                                                <Link
                                                                    href={`/dashboard/sales/daraz/profit-tracker/${o.order_primary_id}`}
                                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-blue-600 dark:text-blue-400 inline-flex items-center justify-center"
                                                                    title="View Details"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* 2. ACCOUNT DETAILS VIEW */}
                {activeSubTab === 'accounts' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Account Profit Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Seller Account</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Total Revenue</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Total Cost</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Total Profit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {(() => {
                                        const accountMap: Record<string, { revenue: number, cost: number, profit: number }> = {}
                                        orders.forEach((o: any) => {
                                            const seller = o.seller_account || 'Unknown'
                                            if (!accountMap[seller]) {
                                                accountMap[seller] = { revenue: 0, cost: 0, profit: 0 }
                                            }
                                            accountMap[seller].revenue += o.total_revenue || 0
                                            accountMap[seller].cost += o.total_purchase_cost || 0
                                            accountMap[seller].profit += o.profit || 0
                                        })

                                        return Object.entries(accountMap).map(([seller, acc]) => (
                                            <TableRow key={seller}>
                                                <TableCell className="font-semibold text-gray-900 dark:text-gray-100 py-3">{seller}</TableCell>
                                                <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100 py-3">Rs. {acc.revenue.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-semibold text-purple-600 dark:text-purple-400 py-3">Rs. {acc.cost.toLocaleString()}</TableCell>
                                                <TableCell className={`text-right font-bold py-3 ${acc.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                    Rs. {acc.profit.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    })()}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* 3. DAILY DETAILS VIEW */}
                {activeSubTab === 'daily' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Daily Profit Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Date</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Profit</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Revenue</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase">Stores</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {Object.keys(stats).sort((a, b) => b.localeCompare(a)).map(dateKey => {
                                        const dayStat = stats[dateKey] || { statsBySeller: {}, totalProfit: 0, totalRevenue: 0, orderNumbers: [] }
                                        const storeCount = Object.keys(dayStat.statsBySeller || {}).length
                                        const dayOrderNumbers = dayStat.orderNumbers || []
                                        const dateObj = new Date(dateKey)
                                        const dateFormatted = !isNaN(dateObj.getTime()) ? format(dateObj, 'EEEE, MMM d, yyyy') : dateKey
                                        const totalProfit = dayStat.totalProfit || 0
                                        const totalRevenue = dayStat.totalRevenue || 0

                                        return (
                                            <TableRow key={dateKey}>
                                                <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3.5">
                                                    {dateFormatted}
                                                </TableCell>

                                                <TableCell className={`text-right font-bold py-3.5 ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                    Rs. {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>

                                                <TableCell className="text-right font-medium py-3.5 text-gray-900 dark:text-gray-100">
                                                    Rs. {totalRevenue.toLocaleString()}
                                                </TableCell>

                                                <TableCell className="text-center font-medium text-gray-600 dark:text-gray-300 py-3.5">
                                                    {storeCount} Stores
                                                </TableCell>

                                                <TableCell className="text-center py-3.5">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSelectedDailyDateKey(dateKey)}
                                                        className="h-8 text-xs font-semibold px-3 rounded-lg border-gray-300 hover:bg-gray-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                                                    >
                                                        View Breakdown
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Dedicated Daily Breakdown Modal */}
                        {selectedDailyDateKey && (
                            <DailyBreakdownModal
                                dateKey={selectedDailyDateKey}
                                dayStat={stats[selectedDailyDateKey]}
                                isOpen={!!selectedDailyDateKey}
                                onClose={() => setSelectedDailyDateKey(null)}
                                defaultSellerAccount={sellerAccount}
                            />
                        )}
                    </Card>
                )}

                {/* 4. WEEKLY DETAILS VIEW */}
                {activeSubTab === 'weekly' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Weekly Profit Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Week Range</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase">Orders</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Revenue</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Purchase Cost</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Profit</TableHead>
                                        <TableHead className="text-center text-[11px] font-bold uppercase">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {sortedWeeklyKeys.map(weekKey => {
                                        const w = weeklyMap[weekKey]
                                        const startStr = format(w.start, 'yyyy-MM-dd')
                                        const endStr = format(w.end, 'yyyy-MM-dd')

                                        return (
                                            <Fragment key={weekKey}>
                                                {/* Main Week Summary Header Row */}
                                                <TableRow className="bg-gray-50/90 dark:bg-zinc-800/80 font-semibold border-b border-gray-200 dark:border-zinc-700">
                                                    <TableCell className="py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100">
                                                                {format(w.start, 'MMM d')} - {format(w.end, 'MMM d, yyyy')}
                                                            </span>
                                                            <span className="text-[11px] text-gray-500 font-medium">
                                                                Week {w.weekNum}
                                                            </span>
                                                            {w.totalUnsynced > 0 && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
                                                                    ⚠ {w.totalUnsynced} unsynced
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>

                                                    <TableCell className="text-center font-bold text-gray-900 dark:text-gray-100 py-3">
                                                        {w.totalOrders}
                                                    </TableCell>

                                                    <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100 py-3">
                                                        Rs. {w.totalRevenue.toLocaleString()}
                                                    </TableCell>

                                                    <TableCell className="text-right font-semibold text-purple-600 dark:text-purple-400 py-3">
                                                        Rs. {w.totalCost.toLocaleString()}
                                                    </TableCell>

                                                    <TableCell className={`text-right font-bold py-3 ${w.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                        Rs. {w.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>

                                                    <TableCell className="text-center py-3">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setSelectedWeekRange({ start: startStr, end: endStr })}
                                                            className="h-8 text-xs font-semibold px-3 rounded-lg border-gray-300 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
                                                        >
                                                            View More
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Per-Store Sub Rows */}
                                                {Object.entries(w.statsBySeller || {}).map(([seller, s]: [string, any]) => (
                                                    <TableRow key={`${weekKey}-${seller}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 text-xs border-b border-gray-100 dark:border-zinc-800/50">
                                                        <TableCell className="pl-6 py-2.5 font-medium text-gray-700 dark:text-gray-300">
                                                            <div className="flex items-center gap-2">
                                                                <span>{seller}</span>
                                                                {s.missing > 0 && (
                                                                    <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 px-1.5 py-0.2 rounded-full">
                                                                        {s.missing} unsynced orders
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center text-gray-600 dark:text-gray-400 py-2.5">{s.count || 0}</TableCell>
                                                        <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">Rs. {(s.revenue || 0).toLocaleString()}</TableCell>
                                                        <TableCell className="text-right text-purple-600/80 dark:text-purple-400/80 py-2.5">Rs. {(s.cost || 0).toLocaleString()}</TableCell>
                                                        <TableCell className={`text-right font-semibold py-2.5 ${s.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                            Rs. {(s.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-center py-2.5"></TableCell>
                                                    </TableRow>
                                                ))}
                                            </Fragment>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* 5. MONTHLY DETAILS VIEW */}
                {activeSubTab === 'monthly' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Monthly Profit Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Month</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Monthly Profit</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Monthly Revenue</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Breakdown by Seller</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {(() => {
                                        const monthlyMap: Record<string, { totalProfit: number, totalRevenue: number, statsBySeller: Record<string, { profit: number, revenue: number }> }> = {}
                                        Object.keys(stats).forEach(date => {
                                            const d = new Date(date)
                                            if (isNaN(d.getTime())) return
                                            const monthKey = format(d, 'MMMM yyyy')

                                            if (!monthlyMap[monthKey]) {
                                                monthlyMap[monthKey] = { totalProfit: 0, totalRevenue: 0, statsBySeller: {} }
                                            }

                                            const day = stats[date]
                                            monthlyMap[monthKey].totalProfit += (day.totalProfit || 0)
                                            monthlyMap[monthKey].totalRevenue += (day.totalRevenue || 0)

                                            Object.entries(day.statsBySeller || {}).forEach(([seller, s]: [string, any]) => {
                                                if (!monthlyMap[monthKey].statsBySeller[seller]) {
                                                    monthlyMap[monthKey].statsBySeller[seller] = { profit: 0, revenue: 0 }
                                                }
                                                monthlyMap[monthKey].statsBySeller[seller].profit += (s.profit || 0)
                                                monthlyMap[monthKey].statsBySeller[seller].revenue += (s.revenue || 0)
                                            })
                                        })

                                        const sortedMonths = Object.keys(monthlyMap).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

                                        return sortedMonths.map(month => {
                                            const m = monthlyMap[month]
                                            return (
                                                <TableRow key={month}>
                                                    <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3">{month}</TableCell>
                                                    <TableCell className={`text-right font-bold py-3 ${m.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        Rs. {m.totalProfit.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-3">Rs. {m.totalRevenue.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right py-3">
                                                        <div className="text-xs space-y-1">
                                                            {Object.entries(m.statsBySeller).map(([seller, s]) => (
                                                                <div key={seller} className="flex justify-between gap-4">
                                                                    <span className="text-gray-500">{seller}:</span>
                                                                    <span className={s.profit >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>
                                                                        Rs. {s.profit?.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    })()}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* 6. REPORT BY API VIEW */}
                {activeSubTab === 'report-api' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Report By API - Weekly Breakdown</h3>
                                <p className="text-xs text-gray-500">
                                    Weekly payout statement receivables, returned orders, and order purchase costs matched per store
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Fiscal Year:</span>
                                <select
                                    value={selectedFYId}
                                    onChange={(e) => setSelectedFYId(e.target.value)}
                                    className="h-8 rounded-lg border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-900 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 shadow-2xs"
                                >
                                    <option value="all">All Fiscal Years</option>
                                    {fiscalYears.map((fy: any) => (
                                        <option key={fy.id} value={fy.id}>
                                            {fy.name} {fy.is_active ? '(Running)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            {isPayoutLoading ? (
                                <div className="py-12 text-center flex flex-col items-center justify-center space-y-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                    <p className="text-xs text-gray-500">Loading Report & Payout Data...</p>
                                </div>
                            ) : apiReportWeeklyData.sortedKeys.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 text-xs">
                                    No Report By API statement details found for the selected Fiscal Year.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                        <TableRow>
                                            <TableHead className="text-[11px] font-bold uppercase">Week Range</TableHead>
                                            <TableHead className="text-center text-[11px] font-bold uppercase">Orders</TableHead>
                                            <TableHead className="text-right text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400">Receivable Amount</TableHead>
                                            <TableHead className="text-right text-[11px] font-bold uppercase text-purple-600 dark:text-purple-400">Purchase Cost</TableHead>
                                            <TableHead className="text-right text-[11px] font-bold uppercase text-amber-600 dark:text-amber-400">Returned Orders</TableHead>
                                            <TableHead className="text-right text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs">
                                        {apiReportWeeklyData.sortedKeys.map((weekKey) => {
                                            const w = apiReportWeeklyData.map[weekKey]
                                            return (
                                                <Fragment key={weekKey}>
                                                    {/* Main Week Head Summary Row */}
                                                    <TableRow className="bg-gray-50/90 dark:bg-zinc-800/80 font-semibold border-b border-gray-200 dark:border-zinc-700">
                                                        <TableCell className="py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                                                    {w.weekLabel}
                                                                </span>
                                                                <span className="text-[11px] text-gray-500 font-medium">
                                                                    Week {w.weekNum}
                                                                </span>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-center font-bold text-gray-900 dark:text-gray-100 py-3">
                                                            {w.totalOrders}
                                                        </TableCell>

                                                        <TableCell className="text-right font-mono font-bold text-blue-600 dark:text-blue-400 py-3">
                                                            NPR {w.totalReceivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>

                                                        <TableCell className="text-right font-mono font-semibold text-purple-600 dark:text-purple-400 py-3">
                                                            Rs. {w.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>

                                                        <TableCell className="text-right font-mono font-semibold text-amber-600 dark:text-amber-400 py-3">
                                                            NPR {w.totalReturned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>

                                                        <TableCell className={`text-right font-mono font-bold py-3 ${w.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                            Rs. {w.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                    </TableRow>

                                                    {/* Per-Store Sub Rows */}
                                                    {Object.entries(w.stores || {}).map(([seller, st]: [string, any]) => (
                                                        <TableRow key={`${weekKey}-${seller}`} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 text-xs border-b border-gray-100 dark:border-zinc-800/50">
                                                            <TableCell className="pl-6 py-2.5 font-medium text-gray-700 dark:text-gray-300">
                                                                <span>{seller}</span>
                                                            </TableCell>
                                                            <TableCell className="text-center text-gray-600 dark:text-gray-400 py-2.5">{st.count || 0}</TableCell>
                                                            <TableCell className="text-right font-mono text-blue-600/90 dark:text-blue-400/90 py-2.5">
                                                                NPR {st.receivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-purple-600/80 dark:text-purple-400/80 py-2.5">
                                                                Rs. {st.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell className="text-right font-mono text-amber-600/90 dark:text-amber-400/90 py-2.5">
                                                                NPR {st.returned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell className={`text-right font-mono font-semibold py-2.5 ${st.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                                Rs. {st.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </Fragment>
                                            )
                                        })}
                                    </TableBody>
                                    <TableFooter className="bg-gray-100 dark:bg-zinc-800/90 border-t-2 border-gray-300 dark:border-zinc-700 font-extrabold text-xs">
                                        <TableRow>
                                            <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3.5">
                                                Total ({apiReportWeeklyData.sortedKeys.length} Weeks)
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-gray-900 dark:text-gray-100 py-3.5">
                                                {apiReportWeeklyData.totals.orders}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-extrabold text-blue-600 dark:text-blue-400 text-sm py-3.5">
                                                NPR {apiReportWeeklyData.totals.receivable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-extrabold text-purple-600 dark:text-purple-400 text-sm py-3.5">
                                                Rs. {apiReportWeeklyData.totals.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm py-3.5">
                                                NPR {apiReportWeeklyData.totals.returned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className={`text-right font-mono font-extrabold text-sm py-3.5 ${apiReportWeeklyData.totals.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                                                Rs. {apiReportWeeklyData.totals.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            )}
                        </div>
                    </Card>
                )}

                {/* Footer Controls */}
                {activeSubTab === 'orders' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 items-center py-4 gap-4 relative">
                        <div className="justify-self-start">
                            <LimitSelector currentLimit={limit} onLimitChange={(val) => { setLimit(val); setPage(1); }} />
                        </div>

                        <div className="justify-self-center flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page > 1
                                    ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                    : 'opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                Previous
                            </button>

                            {totalPages > 1 && Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                                .map((p, i, arr) => {
                                    const showEllipsis = i > 0 && arr[i - 1] !== p - 1
                                    return (
                                        <Fragment key={p}>
                                            {showEllipsis && <span className="px-1 text-[13px] text-gray-400">...</span>}
                                            <button
                                                onClick={() => setPage(p)}
                                                className={`px-2 py-0.5 text-[13px] rounded transition-colors ${p === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'border dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        </Fragment>
                                    )
                                })
                            }

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className={`px-2 py-0.5 text-[13px] border dark:border-zinc-700 rounded transition-colors ${page < totalPages
                                    ? 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                                    : 'opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                Next
                            </button>
                        </div>

                        <div className="justify-self-end text-sm text-gray-500">
                            Page {page} of {totalPages} ({totalCount} items)
                        </div>
                    </div>
                )}
            </div>

            {/* Weekly Order Details Modal */}
            <WeeklyDetailsModal weekRange={selectedWeekRange} onClose={() => setSelectedWeekRange(null)} />
        </div>
    )
}
