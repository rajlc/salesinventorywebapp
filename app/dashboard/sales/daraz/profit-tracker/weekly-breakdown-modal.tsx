'use client'

import { useState, useMemo, useEffect } from 'react'
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
    Input,
    Button,
} from '@/components/ui-shim'
import { useQuery } from '@tanstack/react-query'
import { getProfitTrackerData, getSellerAccounts } from '@/features/sales/actions/report-actions'
import { Search, Loader2, Filter } from 'lucide-react'

interface WeeklyBreakdownModalProps {
    isOpen: boolean
    onClose: () => void
    startDate: string
    endDate: string
}

export function WeeklyBreakdownModal({ isOpen, onClose, startDate, endDate }: WeeklyBreakdownModalProps) {
    const [search, setSearch] = useState('')
    const [sellerFilter, setSellerFilter] = useState('All')
    const [availableSellers, setAvailableSellers] = useState<string[]>([])
    const [showUnsyncedOnly, setShowUnsyncedOnly] = useState(false)

    useEffect(() => {
        getSellerAccounts().then(setAvailableSellers)
    }, [])

    const { data, isLoading } = useQuery({
        queryKey: ['weekly-orders', startDate, endDate],
        queryFn: () => getProfitTrackerData({
            startDate,
            endDate,
            limit: 2000, // Large limit to get all orders for the week
            syncStatus: 'all'
        }),
        enabled: isOpen
    })

    const orders = data?.data || []

    const explodedRows = useMemo(() => {
        const rows: any[] = []
        orders.forEach((order: any) => {
            const matchesSearch = !search || order.order_number.toLowerCase().includes(search.toLowerCase())
            const matchesSeller = sellerFilter === 'All' || order.seller_account === sellerFilter
            const matchesSync = !showUnsyncedOnly || order.sync_status === 'not_synced'

            if (matchesSearch && matchesSeller && matchesSync) {
                if (order.products && order.products.length > 0) {
                    order.products.forEach((p: any) => {
                        rows.push({
                            order_number: order.order_number,
                            product_name: p.product_name,
                            quantity: p.quantity,
                            sales_amount: p.amount,
                            purchase_cost: p.purchase_cost,
                            // Daraz fees are usually per order, but we can distribute or show on order level.
                            // The user requested: Sales Amount, Purchase cost, Daraz Fee, Total Profit.
                            // Usually, Profit = Revenue - Purchase Cost - Daraz Fee - 30.
                            // If multiple products, it's hard to split Daraz fees exactly unless we have item-level fee data.
                            // However, we'll show the order-level fees and profit on each row or the first row.
                            // The requirement says: "show total profit of order which we had already made in order details"
                            daraz_fee: order.daraz_fees,
                            total_profit: order.profit,
                            sync_status: order.sync_status
                        })
                    })
                } else {
                    rows.push({
                        order_number: order.order_number,
                        product_name: 'Unknown Product',
                        quantity: 1,
                        sales_amount: order.total_revenue,
                        purchase_cost: order.total_purchase_cost,
                        daraz_fee: order.daraz_fees,
                        total_profit: order.profit,
                        sync_status: order.sync_status
                    })
                }
            }
        })
        return rows
    }, [orders, search, sellerFilter, showUnsyncedOnly])

    // Totals for the footer
    // Note: Since we exploded rows, summing daraz_fee and total_profit from rows would double count.
    // We should sum from unique orders.
    const uniqueOrders = useMemo(() => {
        const seen = new Set()
        return orders.filter((o: any) => {
            const matchesSearch = !search || o.order_number.toLowerCase().includes(search.toLowerCase())
            const matchesSeller = sellerFilter === 'All' || o.seller_account === sellerFilter
            const matchesSync = !showUnsyncedOnly || o.sync_status === 'not_synced'
            if (!matchesSearch || !matchesSeller || !matchesSync) return false
            
            if (seen.has(o.order_number)) return false
            seen.add(o.order_number)
            return true
        })
    }, [orders, search, sellerFilter, showUnsyncedOnly])

    const totals = useMemo(() => {
        return {
            sales: uniqueOrders.reduce((sum, o: any) => sum + (o.total_revenue || 0), 0),
            purchase: uniqueOrders.reduce((sum, o: any) => sum + (o.total_purchase_cost || 0), 0),
            fees: uniqueOrders.reduce((sum, o: any) => sum + (o.daraz_fee || o.daraz_fees || 0), 0),
            profit: uniqueOrders.reduce((sum, o: any) => sum + (o.profit || 0), 0)
        }
    }, [uniqueOrders])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl flex items-center justify-between">
                        <span>Weekly Order Details ({startDate} to {endDate})</span>
                    </DialogTitle>
                    <div className="flex flex-col md:flex-row gap-4 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by Order Number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                type="button"
                                variant={showUnsyncedOnly ? "destructive" : "outline"}
                                onClick={() => setShowUnsyncedOnly(!showUnsyncedOnly)}
                                className="h-10 text-xs font-semibold px-4 shrink-0 transition-colors"
                            >
                                {showUnsyncedOnly ? "Show All Orders" : "Show Unsynced Only"}
                            </Button>

                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-gray-400" />
                                <select
                                    value={sellerFilter}
                                    onChange={(e) => setSellerFilter(e.target.value)}
                                    className="h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
                                >
                                    <option value="All">All Sellers</option>
                                    {availableSellers.map(seller => (
                                        <option key={seller} value={seller}>{seller}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-auto p-6 pt-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            Loading orders for the week...
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-gray-50 dark:bg-zinc-800 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-12">S.N</TableHead>
                                    <TableHead className="w-[100px]">Sync Status</TableHead>
                                    <TableHead>Order Number</TableHead>
                                    <TableHead className="min-w-[200px]">Product Name</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Sales Amount</TableHead>
                                    <TableHead className="text-right">Purchase Cost</TableHead>
                                    <TableHead className="text-right">Daraz Fee</TableHead>
                                    <TableHead className="text-right">Total Profit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {explodedRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="h-32 text-center text-gray-500">
                                            No orders found for the selected filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    explodedRows.map((row, idx) => {
                                        // To avoid repeating order-level data like fees and profit for multiple items in same order,
                                        // we can show them only on the first item of that order.
                                        const isFirstInOrder = idx === 0 || explodedRows[idx - 1].order_number !== row.order_number;
                                        
                                        return (
                                            <TableRow key={`${row.order_number}-${idx}`} className={!isFirstInOrder ? "border-t-0 opacity-80" : ""}>
                                                <TableCell className="text-gray-500 text-xs">{idx + 1}</TableCell>
                                                <TableCell>
                                                    {isFirstInOrder ? (
                                                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${row.sync_status === 'synced'
                                                            ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                                            }`}>
                                                            {row.sync_status === 'synced' ? 'Synced' : 'Not Synced'}
                                                        </div>
                                                    ) : ""}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {isFirstInOrder ? row.order_number : ""}
                                                </TableCell>
                                                <TableCell className="text-xs max-w-[300px] truncate" title={row.product_name}>
                                                    {row.product_name}
                                                </TableCell>
                                                <TableCell className="text-center text-xs">{row.quantity}</TableCell>
                                                <TableCell className="text-right text-xs">Rs. {row.sales_amount?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-xs">Rs. {row.purchase_cost?.toLocaleString()}</TableCell>
                                                <TableCell className="text-right text-xs text-amber-600">
                                                    {isFirstInOrder && row.daraz_fee ? `Rs. ${row.daraz_fee.toLocaleString()}` : ""}
                                                </TableCell>
                                                <TableCell className={`text-right text-xs font-bold ${row.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isFirstInOrder ? `Rs. ${row.total_profit?.toLocaleString()}` : ""}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <div className="p-6 bg-gray-50 dark:bg-zinc-800 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase">Total Sales</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Rs. {totals.sales.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase">Purchase Cost</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Rs. {totals.purchase.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase">Daraz Fees</p>
                        <p className="text-lg font-bold text-amber-600">Rs. {totals.fees.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-gray-500 uppercase">Total Profit</p>
                        <p className={`text-lg font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            Rs. {totals.profit.toLocaleString()}
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
