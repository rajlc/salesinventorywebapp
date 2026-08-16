'use client'

import { Fragment, useState, useEffect } from 'react'
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

            <div className={`sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-4 py-3 md:px-6 shadow-sm`}>
                <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1">
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
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-6 space-y-4">
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <Table>
                        <TableHeader className="bg-gray-50 dark:bg-zinc-800/60">
                            <TableRow>
                                <TableHead className="w-12 text-center text-[10px] font-bold uppercase">S.N</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Order # & Date</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Seller Account</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Revenue</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Purchase Cost</TableHead>
                                <TableHead className="text-right text-[10px] font-bold uppercase">Net Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((o: any, idx: number) => (
                                <TableRow key={o.order_primary_id} className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 text-xs">
                                    <TableCell className="text-center font-medium text-gray-400">{(page - 1) * limit + idx + 1}</TableCell>
                                    <TableCell className="font-bold text-gray-900 dark:text-gray-100">#{o.order_number}</TableCell>
                                    <TableCell>{o.seller_account || 'Unknown'}</TableCell>
                                    <TableCell className="text-right font-bold">Rs. {(o.total_revenue || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-purple-600">Rs. {(o.total_purchase_cost || 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-extrabold text-emerald-600">Rs. {(o.profit || 0).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}
