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

function ProfitTrackerContent({ isEmbedded = false }: { isEmbedded?: boolean }) {
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
            // console.log('[PROFIT TRACKER] Fetching orders...')
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
                // console.log('[PROFIT TRACKER] Orders fetched')
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
        queryKey: ['complete-date-stats', search, syncStatus, sellerAccount], // Exclude page/limit from key
        queryFn: async () => {
            try {
                return await getCompleteDateStats({
                    page: 1,
                    limit: 100, // Not used for this function, but passing to satisfy interface
                    search,
                    syncStatus,
                    sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
                    startDate: undefined,
                    endDate: undefined
                });
            } catch (err) {
                console.error('[PROFIT TRACKER] Complete date stats fetch error:', err);
                return {}; // Return empty object if there's an error
            }
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        placeholderData: keepPreviousData
    });

    const { data: dailyStats, isLoading: isStatsLoading } = useQuery({
        queryKey: ['daily-profit-stats', search, syncStatus, sellerAccount],
        queryFn: async () => {
            // console.log('[PROFIT TRACKER] Fetching stats...')
            return getDailyProfitStats({
                search,
                syncStatus,
                sellerAccount: sellerAccount === 'All' ? undefined : sellerAccount,
                startDate: undefined,
                endDate: undefined
            })
        },
        staleTime: 5 * 60 * 1000, // Cache stats for 5 mins
        placeholderData: keepPreviousData
    })

    const orders = profitData?.data || []
    const totalCount = profitData?.totalCount || 0
    const totalPages = profitData?.totalPages || 0
    const rawStatsList: any[] = Array.isArray(dailyStats) ? dailyStats : []
    const isLoading = isOrdersLoading // Only block table on orders loading. Stats can pop in later.

    // Use complete date stats for group headers to show stats for all orders in each date group
    // Fall back to current logic if complete stats are not available
    const stats: any = completeDateStats ? JSON.parse(JSON.stringify(completeDateStats)) : {};

    // If complete date stats are not available, calculate from current page data
    if (Object.keys(stats).length === 0) {
        // Client-Side Aggregation of Stats
        // We process the raw list from backend to match Frontend/Local Timezone grouping

        // If rawStatsList is empty, calculate stats from order data
        if (rawStatsList.length === 0 && orders.length > 0) {
            // Calculate stats from order data
            orders.forEach((order: any) => {
                if (!order.delivered_by_daraz && !order.delivered_at) return

                const dateRaw = order.delivered_by_daraz || order.delivered_at
                const dateKey = format(new Date(dateRaw), 'yyyy-MM-dd') // Local Time Grouping

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
                const isMissing = orderCost <= 0 // If cost is missing, mark as missing

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
            // Use the raw stats from the API call
            rawStatsList.forEach((stat: any) => {
                if (!stat.date) return
                const dateKey = format(new Date(stat.date), 'yyyy-MM-dd') // Local Time Grouping

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
        // Priority: delivered_by_daraz > delivered_at
        const dateRaw = order.delivered_by_daraz || order.delivered_at
        const dateKey = dateRaw ? format(new Date(dateRaw), 'yyyy-MM-dd') : 'Unknown Date'

        if (!groups[dateKey]) {
            // Use aggregated stats for this day
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
        const start = startOfWeek(d, { weekStartsOn: 1 }); // Monday
        const end = endOfWeek(d, { weekStartsOn: 1 }); // Sunday
        const weekKey = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`;

        const day = stats[date];

        if (!weeklyMap[weekKey]) {
            weeklyMap[weekKey] = { 
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

        weeklyMap[weekKey].totalProfit += (day.totalProfit || 0);
        weeklyMap[weekKey].totalRevenue += (day.totalRevenue || 0);
        
        // Summing cost and order count requires iterating through sellers for the day
        Object.entries(day.statsBySeller).forEach(([seller, s]: [string, any]) => {
            if (!weeklyMap[weekKey].statsBySeller[seller]) {
                weeklyMap[weekKey].statsBySeller[seller] = { profit: 0, revenue: 0, cost: 0, count: 0, missing: 0 };
            }
            weeklyMap[weekKey].statsBySeller[seller].profit += (s.profit || 0);
            weeklyMap[weekKey].statsBySeller[seller].revenue += (s.revenue || 0);
            weeklyMap[weekKey].statsBySeller[seller].cost += (s.cost || 0);
            weeklyMap[weekKey].statsBySeller[seller].count += (s.count || 0);
            weeklyMap[weekKey].statsBySeller[seller].missing += (s.missing || 0);
            
            weeklyMap[weekKey].totalCost += (s.cost || 0);
            weeklyMap[weekKey].orderCount += (s.count || 0);
            weeklyMap[weekKey].totalMissing += (s.missing || 0);
        });
    });

    const sortedWeekKeys = Object.keys(weeklyMap).sort((a, b) => b.localeCompare(a));

    // Re-check getCompleteDateStats to see if it provides order count per seller
    // (I'll check this in the next step, for now I'll continue with the grouping)



    const sortedDateKeys = Object.keys(groupedOrders).sort((a, b) => {
        if (a === 'Unknown Date') return 1
        if (b === 'Unknown Date') return -1
        return b.localeCompare(a)
    })

    // Remove globalIndex usage for S.N reset
    // let globalIndex = 0
    const visibleOrderNumbers = orders.map((o: any) => o.order_number)

    return (
        <div className="flex flex-col min-h-full bg-gray-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg">
            {/* Error Message */}
            {ordersError && (
                <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <div className="flex-1">
                        <p className="font-semibold text-sm">Action Failed</p>
                        <p className="text-xs">{(ordersError as any)?.message || 'Something went wrong while fetching profit data.'}</p>
                    </div>
                </div>
            )}
            {/* Unified Controls Bar */}
            <div className={`sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 md:px-6 shadow-sm`}>
                <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Tab Navigation & Search */}
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
                        {/* Sub-Tab Navigation */}
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
                                <span className="hidden sm:inline">Daily Details</span>
                                <span className="sm:hidden">Daily</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('weekly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'weekly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">Weekly Details</span>
                                <span className="sm:hidden">Weekly</span>
                            </button>
                            <button
                                onClick={() => handleSubTabChange('monthly')}
                                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeSubTab === 'monthly'
                                    ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                <BarChart3 className="h-4 w-4" />
                                <span className="hidden sm:inline">Monthly Details</span>
                                <span className="sm:hidden">Monthly</span>
                            </button>
                        </div>

                        {/* Search Box */}
                        <div className="w-full md:max-w-xs relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value)
                                    setPage(1)
                                }}
                                type="text"
                                placeholder="Search Orders..."
                                className="w-full pl-9 h-9 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Right: Sync & Filters (Only for Orders tab) */}
                    {activeSubTab === 'orders' && (
                        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar py-1 md:py-0">
                            <BulkSyncButton orderNumbers={visibleOrderNumbers} />

                            <select
                                value={syncStatus}
                                onChange={(e) => {
                                    setSyncStatus(e.target.value as any)
                                    setPage(1)
                                }}
                                className="h-9 px-3 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 font-medium"
                            >
                                <option value="all">All</option>
                                <option value="synced">Synced</option>
                                <option value="not_synced">Not Synced</option>
                            </select>

                            <select
                                value={sellerAccount}
                                onChange={(e) => {
                                    setSellerAccount(e.target.value)
                                    setPage(1)
                                }}
                                className="h-9 px-3 text-sm rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-gray-100 font-medium"
                            >
                                <option value="All">All Seller Accounts</option>
                                {availableSellers.map((seller) => (
                                    <option key={seller} value={seller}>
                                        {seller}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>


            <div className="p-2 md:p-6 space-y-4">
                {/* Legacy Sub-Tab Navigation removed to avoid duplication */}

                {activeSubTab === 'orders' && (
                    <>
                        {/* Table */}
                        <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                            <div className="overflow-x-auto">
                                <Table className="min-w-[800px]">
                                    <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                        <TableRow>
                                            <TableHead className="w-16">S.N</TableHead>
                                            <TableHead className="w-[100px]">Sync Status</TableHead>
                                            <TableHead>Delivered Date</TableHead>
                                            <TableHead>Order Number</TableHead>
                                            <TableHead>Seller Account</TableHead>
                                            <TableHead>Product Name</TableHead>
                                            <TableHead className="text-right">Product Price</TableHead>
                                            <TableHead className="text-right">Purchase Cost</TableHead>
                                            <TableHead className="text-right">Profit</TableHead>
                                            <TableHead className="text-center w-[100px]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="h-48 text-center text-gray-500">
                                                    Loading data...
                                                </TableCell>
                                            </TableRow>
                                        ) : orders.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="h-24 text-center text-gray-500">
                                                    No delivered orders found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedDateKeys.map((dateKey) => {
                                                const group = groupedOrders[dateKey]
                                                return (
                                                    <Fragment key={dateKey}>
                                                        {/* Group Header */}
                                                        <TableRow className="bg-gray-100 dark:bg-zinc-800/80 border-b border-gray-200 dark:border-zinc-700">
                                                            {/* Date Cell */}
                                                            <TableCell colSpan={2} className="py-3 pl-4 align-top border-r border-gray-200 dark:border-zinc-700/50">
                                                                <span className="font-bold text-gray-700 dark:text-gray-200 text-sm whitespace-nowrap">
                                                                    {group.dateLabel}
                                                                </span>
                                                            </TableCell>

                                                            {/* Stats Cell */}
                                                            <TableCell colSpan={6} className="py-3 px-4 align-top">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {Object.entries(group.statsBySeller).map(([seller, stats]: [string, any]) => (
                                                                        <div key={seller} className="flex items-center gap-3 text-xs bg-white dark:bg-zinc-900/50 px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 w-fit shadow-sm">
                                                                            <span className="font-semibold text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={seller}>
                                                                                {seller}
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1">
                                                                                <span className="text-gray-500">Profit:</span>
                                                                                <span className={`font-medium ${(stats.profit || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                    Rs. {(stats.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1">
                                                                                <span className="text-gray-500">Total:</span>
                                                                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                                    Rs. {(stats.revenue || 0).toLocaleString()}
                                                                                </span>
                                                                            </span>
                                                                            <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                            <span className="flex items-center gap-1">
                                                                                <span className="text-gray-500">Cost:</span>
                                                                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                                                                    Rs. {(stats.cost || 0).toLocaleString()}
                                                                                </span>
                                                                            </span>
                                                                            {stats.missing > 0 && (
                                                                                <>
                                                                                    <span className="text-gray-300 dark:text-zinc-700">|</span>
                                                                                    <span className="text-red-600 font-medium flex items-center gap-1">
                                                                                        <AlertTriangle className="w-3 h-3 text-red-500" /> {stats.missing} Missing
                                                                                    </span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell colSpan={2} className="text-right font-bold py-3 pr-4 text-gray-900 dark:text-gray-100 align-top">
                                                                <div className="flex items-center justify-end gap-2 h-full min-h-[28px]">
                                                                    <span className="text-xs text-gray-500 font-normal uppercase">TP :</span>
                                                                    <span className={`${(group.totalProfit || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                        Rs. {(group.totalProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>

                                                        {/* Group Rows */}
                                                        {group.orders.map((order: any, i: number) => {
                                                            // Reset S.N per group, but respect pagination offset for the FIRST group on the page
                                                            const groupSNIndex = (dateKey === sortedDateKeys[0])
                                                                ? (profitData?.firstItemOffset || 0) + i + 1
                                                                : i + 1

                                                            const isSynced = order.sync_status === 'synced'

                                                            return (
                                                                <TableRow key={order.order_primary_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                                    <TableCell className="text-gray-500 font-medium">
                                                                        {groupSNIndex}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${isSynced
                                                                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                                            }`}>
                                                                            {isSynced ? 'Synced' : 'Not Synced'}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex flex-col">
                                                                            <span className={`font-medium text-gray-900 dark:text-gray-100 ${!order.delivered_by_daraz && order.delivered_at ? 'underline decoration-wavy decoration-2 decoration-amber-500 font-bold' : ''}`}
                                                                                title={!order.delivered_by_daraz && order.delivered_at ? 'Using Sync Time (Official Time Missing)' : 'Official Delivery Time'}
                                                                            >
                                                                                {(order.delivered_by_daraz || order.delivered_at) ? format(new Date(order.delivered_by_daraz || order.delivered_at), 'MM/dd/yyyy') : '-'}
                                                                            </span>
                                                                            <span className="text-xs text-gray-400">
                                                                                {(order.delivered_by_daraz || order.delivered_at) ? format(new Date(order.delivered_by_daraz || order.delivered_at), 'h:mm a') : ''}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <Link
                                                                                href={`/dashboard/sales/daraz/profit-tracker/${order.order_primary_id}`}
                                                                                className="font-mono text-blue-600 dark:text-blue-400 font-medium hover:underline"
                                                                            >
                                                                                {order.order_number}
                                                                            </Link>
                                                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                                                {order.invoice_number || '-'}
                                                                            </span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <span className="px-2 py-1 rounded bg-gray-100 dark:bg-zinc-800 text-xs font-medium">
                                                                            {order.seller_account || 'N/A'}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell children={
                                                                        <div
                                                                            className="max-w-[300px] cursor-help"
                                                                            title={order.products.length > 1 ? order.products.map((p: any) => `${p.product_name}: Rs. ${p.purchase_price?.toLocaleString() || '0'} (x${p.quantity})`).join('\n') : undefined}
                                                                        >
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="truncate block text-sm text-gray-900 dark:text-gray-100">
                                                                                    {order.products?.[0]?.product_name || 'Unknown Product'}
                                                                                </span>
                                                                                <span className="text-xs text-gray-500 font-mono">
                                                                                    ID: {order.products?.[0]?.product_id || 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                            {order.products && order.products.length > 1 && (
                                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1 block">
                                                                                    (+{order.products.length - 1} more)
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    } />
                                                                    <TableCell className="text-right">
                                                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                                            Rs. {order.total_revenue?.toLocaleString() || '0'}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {order.total_purchase_cost > 0 ? (
                                                                            <span
                                                                                className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${order.products.length > 1 ? 'cursor-help border-b border-dotted border-gray-400' : ''}`}
                                                                                title={order.products.length > 1 ? order.products.map((p: any) => `${p.product_name}: Rs. ${p.purchase_price?.toLocaleString() || '0'} (x${p.quantity})`).join('\n') : undefined}
                                                                            >
                                                                                Rs. {order.total_purchase_cost?.toLocaleString() || '0'}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-red-400 text-sm font-medium">Missing</span>
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <div className="flex flex-col items-end">
                                                                            {order.sync_status === 'synced' ? (
                                                                                <>
                                                                                    <span className={`text-sm font-semibold ${(order.profit || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                                        Rs. {order.profit?.toLocaleString() || '0'}
                                                                                    </span>
                                                                                    {order.profit_percentage !== undefined && (
                                                                                        <span className={`text-xs ${(order.profit || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                                            ({order.profit_percentage?.toFixed(2) || '0.00'}%)
                                                                                        </span>
                                                                                    )}
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-red-400 text-sm font-medium">Not Synced</span>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center">
                                                                        <Link href={`/dashboard/sales/daraz/profit-tracker/${order.order_primary_id}`}>
                                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                                <Eye className="h-4 w-4 text-blue-600" />
                                                                            </Button>
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
                        </Card>

                    </>
                )}

                {activeSubTab === 'accounts' && (
                    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900 p-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Store / Account Summary</h2>
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                    <TableRow>
                                        <TableHead>Account Name</TableHead>
                                        <TableHead className="text-right">Total Revenue</TableHead>
                                        <TableHead className="text-right">Total Profit</TableHead>
                                        <TableHead className="text-right">Orders</TableHead>
                                        <TableHead className="text-right">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const accountMap: Record<string, { revenue: number, profit: number, count: number, missing: number }> = {};
                                        Object.values(stats as Record<string, any>).forEach(day => {
                                            Object.entries(day.statsBySeller).forEach(([seller, s]: [string, any]) => {
                                                if (!accountMap[seller]) accountMap[seller] = { revenue: 0, profit: 0, count: 0, missing: 0 };
                                                accountMap[seller].revenue += (s.revenue || 0);
                                                accountMap[seller].profit += (s.profit || 0);
                                                accountMap[seller].missing += (s.missing || 0);
                                            });
                                        });

                                        const sortedAccounts = Object.keys(accountMap).sort();

                                        if (sortedAccounts.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                                        No account data available
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return sortedAccounts.map(account => {
                                            const a = accountMap[account];
                                            return (
                                                <TableRow key={account}>
                                                    <TableCell className="font-semibold text-gray-900 dark:text-gray-100">{account}</TableCell>
                                                    <TableCell className="text-right">Rs. {a.revenue.toLocaleString()}</TableCell>
                                                    <TableCell className={`text-right font-bold ${a.profit >= 0 ? 'text-green-600' : 'text-danger'}`}>
                                                        Rs. {a.profit.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">{a.revenue > 0 ? 'Active' : 'N/A'}</TableCell>
                                                    <TableCell className="text-right">
                                                        {a.missing > 0 ? (
                                                            <span className="text-red-500 font-medium">{a.missing} Missing Costs</span>
                                                        ) : (
                                                            <span className="text-green-500">Synced</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        });
                                    })()}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {activeSubTab === 'daily' && (
                    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900 p-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily Profit Summary</h2>
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Profit</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Stores</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.keys(stats).length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                                                No daily data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        Object.keys(stats).sort((a, b) => b.localeCompare(a)).map(date => {
                                            const day = stats[date];
                                            const sellerCount = Object.keys(day.statsBySeller).length;
                                            return (
                                                <TableRow key={date}>
                                                    <TableCell className="font-medium">
                                                        {format(new Date(date), 'EEEE, MMM d, yyyy')}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-bold ${day.totalProfit >= 0 ? 'text-green-600' : 'text-danger'}`}>
                                                        Rs. {day.totalProfit.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">Rs. {day.totalRevenue.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">{sellerCount} Stores</TableCell>
                                                    <TableCell className="text-center">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="outline" size="sm">View Breakdown</Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="max-w-3xl">
                                                                <DialogHeader>
                                                                    <DialogTitle>Daily Breakdown - {format(new Date(date), 'MMMM d, yyyy')}</DialogTitle>
                                                                </DialogHeader>
                                                                <div className="py-4 space-y-4">
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                                                            <p className="text-xs text-gray-500 uppercase">Total Profit</p>
                                                                            <p className={`text-lg font-bold ${day.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                                Rs. {day.totalProfit.toLocaleString()}
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                                                                            <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
                                                                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                                                                Rs. {day.totalRevenue.toLocaleString()}
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="border rounded-lg overflow-hidden">
                                                                        <Table>
                                                                            <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                                                                <TableRow>
                                                                                    <TableHead>Store Name</TableHead>
                                                                                    <TableHead className="text-right">Profit</TableHead>
                                                                                    <TableHead className="text-right">Revenue</TableHead>
                                                                                    <TableHead className="text-center">Status</TableHead>
                                                                                </TableRow>
                                                                            </TableHeader>
                                                                            <TableBody>
                                                                                {Object.entries(day.statsBySeller).map(([seller, s]: [string, any]) => (
                                                                                    <TableRow key={seller}>
                                                                                        <TableCell className="font-medium">{seller}</TableCell>
                                                                                        <TableCell className={`text-right ${s.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                                            Rs. {s.profit.toLocaleString()}
                                                                                        </TableCell>
                                                                                        <TableCell className="text-right">Rs. {s.revenue.toLocaleString()}</TableCell>
                                                                                        <TableCell className="text-center">
                                                                                            {s.missing > 0 ? (
                                                                                                <span className="text-xs font-bold text-red-500">{s.missing} Missing</span>
                                                                                            ) : (
                                                                                                <span className="text-xs text-green-500">Synced</span>
                                                                                            )}
                                                                                        </TableCell>
                                                                                    </TableRow>
                                                                                ))}
                                                                            </TableBody>
                                                                        </Table>
                                                                    </div>

                                                                    <div className="flex justify-between items-center pt-4">
                                                                        <div className="text-sm text-gray-500">
                                                                            Bulk sync will update fees and purchase costs for all {day.orderNumbers?.length || 0} orders on this day.
                                                                        </div>
                                                                        <BulkSyncButton orderNumbers={day.orderNumbers || []} />
                                                                    </div>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {activeSubTab === 'weekly' && (
                    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900 p-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Weekly Profit Summary</h2>
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                    <TableRow>
                                        <TableHead>Week Range</TableHead>
                                        <TableHead className="text-right">Orders</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Purchase Cost</TableHead>
                                        <TableHead className="text-right">Profit</TableHead>
                                        <TableHead className="text-center">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedWeekKeys.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                                No weekly data available
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sortedWeekKeys.map(weekKey => {
                                            const week = weeklyMap[weekKey];
                                            return (
                                                <Fragment key={weekKey}>
                                                    <TableRow className="bg-gray-50 dark:bg-zinc-800/50">
                                                        <TableCell className="font-bold py-4">
                                                            <div className="flex flex-col">
                                                                <span>{format(week.start, 'MMM d')} - {format(week.end, 'MMM d, yyyy')}</span>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-xs text-gray-500 font-normal">Week {format(week.start, 'w')}</span>
                                                                    {week.totalMissing > 0 && (
                                                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-red-500">
                                                                            ⚠️ {week.totalMissing} unsynced
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium">{week.orderCount}</TableCell>
                                                        <TableCell className="text-right font-medium">Rs. {week.totalRevenue.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-medium text-gray-600 dark:text-gray-400">Rs. {week.totalCost.toLocaleString()}</TableCell>
                                                        <TableCell className={`text-right font-bold ${week.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            Rs. {week.totalProfit.toLocaleString()}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm"
                                                                onClick={() => {
                                                                    setWeeklyDetailInterval({ start: week.start, end: week.end });
                                                                    setIsWeeklyDetailOpen(true);
                                                                }}
                                                            >
                                                                View More
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    {/* Seller Breakdown Sub-rows */}
                                                    {Object.entries(week.statsBySeller)
                                                        .sort((a, b) => b[1].profit - a[1].profit)
                                                        .map(([seller, s]) => (
                                                            <TableRow key={`${weekKey}-${seller}`} className="border-b border-gray-100 dark:border-zinc-800/50 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                                                                <TableCell className="pl-8 text-sm text-gray-500">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                                        <span>{seller}</span>
                                                                        {s.missing > 0 && (
                                                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/50">
                                                                                {s.missing} unsynced {s.missing === 1 ? 'order' : 'orders'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm text-gray-500">{s.count}</TableCell>
                                                                <TableCell className="text-right text-sm text-gray-500">Rs. {s.revenue.toLocaleString()}</TableCell>
                                                                <TableCell className="text-right text-sm text-gray-500">Rs. {s.cost.toLocaleString()}</TableCell>
                                                                <TableCell className={`text-right text-sm font-medium ${s.profit >= 0 ? 'text-green-500/80' : 'text-red-500/80'}`}>
                                                                    Rs. {s.profit.toLocaleString()}
                                                                </TableCell>
                                                                <TableCell />
                                                            </TableRow>
                                                        ))}
                                                </Fragment>
                                            )
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                )}

                {isWeeklyDetailOpen && weeklyDetailInterval && (
                    <WeeklyBreakdownModal
                        isOpen={isWeeklyDetailOpen}
                        onClose={() => setIsWeeklyDetailOpen(false)}
                        startDate={format(weeklyDetailInterval.start, 'yyyy-MM-dd')}
                        endDate={format(weeklyDetailInterval.end, 'yyyy-MM-dd')}
                    />
                )}

                {activeSubTab === 'monthly' && (
                    <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900 p-6">
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Profit Summary</h2>
                            <Table>
                                <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                                    <TableRow>
                                        <TableHead>Month</TableHead>
                                        <TableHead className="text-right">Profit</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Performance Breakdown</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(() => {
                                        const monthlyMap: Record<string, { totalProfit: number, totalRevenue: number, statsBySeller: Record<string, { profit: number, revenue: number }> }> = {};

                                        Object.keys(stats).forEach(date => {
                                            const monthKey = format(new Date(date), 'MMMM yyyy');
                                            const day = stats[date];

                                            if (!monthlyMap[monthKey]) {
                                                monthlyMap[monthKey] = { totalProfit: 0, totalRevenue: 0, statsBySeller: {} };
                                            }

                                            monthlyMap[monthKey].totalProfit += (day.totalProfit || 0);
                                            monthlyMap[monthKey].totalRevenue += (day.totalRevenue || 0);

                                            Object.entries(day.statsBySeller).forEach(([seller, s]: [string, any]) => {
                                                if (!monthlyMap[monthKey].statsBySeller[seller]) {
                                                    monthlyMap[monthKey].statsBySeller[seller] = { profit: 0, revenue: 0 };
                                                }
                                                monthlyMap[monthKey].statsBySeller[seller].profit += (s.profit || 0);
                                                monthlyMap[monthKey].statsBySeller[seller].revenue += (s.revenue || 0);
                                            });
                                        });

                                        const sortedMonths = Object.keys(monthlyMap).sort((a, b) => {
                                            return new Date(b).getTime() - new Date(a).getTime();
                                        });

                                        if (sortedMonths.length === 0) {
                                            return (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                                        No monthly data available
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }

                                        return sortedMonths.map(month => {
                                            const m = monthlyMap[month];
                                            return (
                                                <TableRow key={month} className="align-top">
                                                    <TableCell className="font-bold text-gray-900 dark:text-gray-100 py-4">{month}</TableCell>
                                                    <TableCell className={`text-right font-bold py-4 ${m.totalProfit >= 0 ? 'text-green-600' : 'text-danger'}`}>
                                                        Rs. {m.totalProfit.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium py-4">Rs. {m.totalRevenue.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="text-xs space-y-1 py-2">
                                                            {Object.entries(m.statsBySeller)
                                                                .sort((a, b) => b[1].profit - a[1].profit)
                                                                .map(([seller, s]) => (
                                                                    <div key={seller} className="flex justify-between gap-4">
                                                                        <span className="text-gray-500">{seller}:</span>
                                                                        <span className={s.profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                                                                            Rs. {s.profit.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        });
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

export default function ProfitTrackerPage(props: { isEmbedded?: boolean }) {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading profit tracker...</div>}>
            <ProfitTrackerContent {...props} />
        </Suspense>
    )
}
