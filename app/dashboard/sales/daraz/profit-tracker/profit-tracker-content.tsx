'use client'

import { Fragment, useState, useEffect, Suspense } from 'react'
import {
    Card,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui-shim'
import { Search, Eye, AlertTriangle, ClipboardList, LayoutGrid, Calendar, BarChart3, List } from 'lucide-react'
import Link from 'next/link'
import { getProfitTrackerData, getDailyProfitStats, getSellerAccounts, getCompleteDateStats } from '@/features/sales/actions/report-actions'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { BulkSyncButton } from './bulk-sync-button'
import { MobileHeaderAction } from '@/components/MobileHeaderAction'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { WeeklyBreakdownModal } from './weekly-breakdown-modal'

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

export function ProfitTrackerContent({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    // Initialize state directly from URL if possible, otherwise use defaults
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
    const [activeSubTab, setActiveSubTab] = useState<'orders' | 'accounts' | 'daily' | 'weekly' | 'monthly'>('orders')

    const handleSubTabChange = (tab: 'orders' | 'accounts' | 'daily' | 'weekly' | 'monthly') => {
        if (tab !== activeSubTab) {
            setSearch('')
            setPage(1)
            setActiveSubTab(tab)
        }
    }
    const [selectedBreakdownDate, setSelectedBreakdownDate] = useState<string | null>(null)
    const [isWeeklyDetailOpen, setIsWeeklyDetailOpen] = useState(false)
    const [weeklyDetailInterval, setWeeklyDetailInterval] = useState<{ start: Date, end: Date } | null>(null)
    const [availableSellers, setAvailableSellers] = useState<string[]>([])

    // Sync only seller accounts on mount
    useEffect(() => {
        getSellerAccounts().then(setAvailableSellers)
    }, [])

    // Update URL when state changes (only if NOT embedded)
    useEffect(() => {
        if (!isEmbedded) {
            const params = new URLSearchParams(searchParams.toString())

            // Only update if values actually changed to prevent loops
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

    // Data Fetching

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

    // Fetch complete date stats to ensure group headers show stats for all orders in each date group
    const { data: completeDateStats, isLoading: isCompleteStatsLoading } = useQuery({
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

    const { data: dailyStats, isLoading: isStatsLoading } = useQuery({
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
                    stats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0 }
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
                    stats[dateKey].statsBySeller[seller] = { profit: 0, missing: 0, revenue: 0, cost: 0 }
                }

                stats[dateKey].totalProfit += stat.profit
                stats[dateKey].totalRevenue += (stat.revenue || 0)
                stats[dateKey].statsBySeller[seller].profit += stat.profit
                stats[dateKey].statsBySeller[seller].revenue += (stat.revenue || 0)
                stats[dateKey].statsBySeller[seller].cost += (stat.cost || 0)
                stats[dateKey].statsBySeller[seller].missing += stat.missing
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

    // Weekly Grouping Logic
    const weeklyMap: Record<string, { 
        start: Date, 
        end: Date, 
        totalProfit: number, 
        totalRevenue: number, 
        totalCost: number,
        orderCount: number,
        totalMissing: number,
        statsBySeller: Record<string, { profit: number, revenue: number, cost: number, count: number, missing: number }> 
    }> = {};

    Object.keys(stats).forEach(date => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return;

        const start = startOfWeek(d, { weekStartsOn: 1 });
        const end = endOfWeek(d, { weekStartsOn: 1 });
        const key = format(start, 'yyyy-MM-dd');

        if (!weeklyMap[key]) {
            weeklyMap[key] = {
                start,
                end,
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                orderCount: 0,
                totalMissing: 0,
                statsBySeller: {}
            };
        }

        const dayStat = stats[date];
        weeklyMap[key].totalProfit += (dayStat.totalProfit || 0);
        weeklyMap[key].totalRevenue += (dayStat.totalRevenue || 0);

        Object.entries(dayStat.statsBySeller).forEach(([seller, s]: [string, any]) => {
            if (!weeklyMap[key].statsBySeller[seller]) {
                weeklyMap[key].statsBySeller[seller] = { profit: 0, revenue: 0, cost: 0, count: 0, missing: 0 };
            }
            weeklyMap[key].statsBySeller[seller].profit += (s.profit || 0);
            weeklyMap[key].statsBySeller[seller].revenue += (s.revenue || 0);
            weeklyMap[key].statsBySeller[seller].cost += (s.cost || 0);
            weeklyMap[key].statsBySeller[seller].missing += (s.missing || 0);
            weeklyMap[key].totalMissing += (s.missing || 0);
        });
    });

    const sortedWeeklyKeys = Object.keys(weeklyMap).sort((a, b) => b.localeCompare(a));

    const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => {
        if (a === 'Unknown Date') return 1
        if (b === 'Unknown Date') return -1
        return b.localeCompare(a)
    })

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

            {/* Header & Controls */}
            <div className={`sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 md:px-6 shadow-sm`}>
                <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                        {/* Sub Tab Buttons */}
                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg w-fit shrink-0">
                            <button
                                onClick={() => handleSubTabChange('orders')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'orders'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <ClipboardList className="h-4 w-4" />
                                <span className="hidden sm:inline">Orders Details</span>
                                <span className="sm:hidden">Orders</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('accounts')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'accounts'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Account Details</span>
                                <span className="sm:hidden">Accounts</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('daily')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'daily'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <Calendar className="h-4 w-4" />
                                <span className="hidden sm:inline">Daily Overview</span>
                                <span className="sm:hidden">Daily</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('weekly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'weekly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <BarChart3 className="h-4 w-4" />
                                <span className="hidden sm:inline">Weekly Report</span>
                                <span className="sm:hidden">Weekly</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('monthly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'monthly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">Monthly Report</span>
                                <span className="sm:hidden">Monthly</span>
                            </button>
                        </div>

                        {/* Search Input */}
                        {activeSubTab === 'orders' && (
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search order ID..."
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value)
                                        setPage(1)
                                    }}
                                    className="w-full pl-9 pr-4 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                        )}
                    </div>

                    {/* Filter Selectors */}
                    {activeSubTab === 'orders' && (
                        <div className="flex items-center gap-3 self-end md:self-auto">
                            <select
                                value={syncStatus}
                                onChange={(e) => {
                                    setSyncStatus(e.target.value as any)
                                    setPage(1)
                                }}
                                className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                            >
                                <option value="all">All Sync Status</option>
                                <option value="synced">Synced (Cost Found)</option>
                                <option value="not_synced">Not Synced (Missing Cost)</option>
                            </select>

                            <select
                                value={sellerAccount}
                                onChange={(e) => {
                                    setSellerAccount(e.target.value)
                                    setPage(1)
                                }}
                                className="px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                            >
                                <option value="All">All Seller Accounts</option>
                                {availableSellers.map(seller => (
                                    <option key={seller} value={seller}>{seller}</option>
                                ))}
                            </select>

                            <BulkSyncButton />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="p-4 md:p-6 space-y-4">
                {/* 1. ORDERS DETAILS VIEW */}
                {activeSubTab === 'orders' && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                <TableRow>
                                    <TableHead className="w-12 text-center text-[11px] font-bold uppercase">S.N</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase">Order # & Date</TableHead>
                                    <TableHead className="text-[11px] font-bold uppercase">Seller Account</TableHead>
                                    <TableHead className="text-right text-[11px] font-bold uppercase">Revenue</TableHead>
                                    <TableHead className="text-right text-[11px] font-bold uppercase">Purchase Cost</TableHead>
                                    <TableHead className="text-right text-[11px] font-bold uppercase">Net Profit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            Loading orders...
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            No orders found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((o: any, idx: number) => {
                                        const cost = o.total_purchase_cost || 0
                                        const profit = o.profit || 0
                                        const revenue = o.total_revenue || 0

                                        return (
                                            <TableRow key={o.order_primary_id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-xs">
                                                <TableCell className="text-center font-medium text-gray-400 py-3">{(page - 1) * limit + idx + 1}</TableCell>
                                                <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3">
                                                    <Link href={`/dashboard/sales/daraz/profit-tracker/${o.order_primary_id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                                        #{o.order_number}
                                                    </Link>
                                                </TableCell>
                                                <TableCell className="font-medium py-3">{o.seller_account || 'Unknown'}</TableCell>
                                                <TableCell className="text-right font-bold text-gray-900 dark:text-gray-100 py-3">Rs. {revenue.toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-semibold text-purple-600 dark:text-purple-400 py-3">Rs. {cost.toLocaleString()}</TableCell>
                                                <TableCell className={`text-right font-bold py-3 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                    Rs. {profit.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
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

                {/* 3. DAILY OVERVIEW */}
                {activeSubTab === 'daily' && (
                    <Card className="overflow-hidden border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Daily Profit & Revenue Summary</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-bold uppercase">Date</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Daily Profit</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Daily Revenue</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Breakdown by Seller</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {sortedDateKeys.map(dateKey => {
                                        const group = groupedOrders[dateKey]
                                        return (
                                            <TableRow key={dateKey}>
                                                <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3">{group.dateLabel}</TableCell>
                                                <TableCell className={`text-right font-bold py-3 ${group.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    Rs. {group.totalProfit.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-medium py-3">Rs. {group.totalRevenue.toLocaleString()}</TableCell>
                                                <TableCell className="text-right py-3">
                                                    <div className="text-xs space-y-1">
                                                        {Object.entries(group.statsBySeller || {}).map(([seller, s]: [string, any]) => (
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
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* 4. WEEKLY REPORT */}
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
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Weekly Profit</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Weekly Revenue</TableHead>
                                        <TableHead className="text-right text-[11px] font-bold uppercase">Breakdown by Seller</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs">
                                    {sortedWeeklyKeys.map(weekKey => {
                                        const w = weeklyMap[weekKey]
                                        return (
                                            <TableRow key={weekKey}>
                                                <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-3">
                                                    {format(w.start, 'MMM d')} - {format(w.end, 'MMM d, yyyy')}
                                                </TableCell>
                                                <TableCell className={`text-right font-bold py-3 ${w.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    Rs. {w.totalProfit.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-medium py-3">Rs. {w.totalRevenue.toLocaleString()}</TableCell>
                                                <TableCell className="text-right py-3">
                                                    <div className="text-xs space-y-1">
                                                        {Object.entries(w.statsBySeller || {}).map(([seller, s]) => (
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
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {/* 5. MONTHLY REPORT */}
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
        </div>
    )
}
