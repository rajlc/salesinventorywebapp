'use server'

import { getDarazOrderDetailsForReport, syncOrderPurchaseCost } from '@/features/sales/actions/report-actions'
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '@/components/ui-shim'
import { format } from 'date-fns'
import Link from 'next/link'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import { revalidatePath } from 'next/cache'

export default async function OrderReportDetailPage({ params }: { params: { orderNumber: string } }) {
    const order = await getDarazOrderDetailsForReport(params.orderNumber)

    // Inline action for single order sync
    async function handleSingleSync() {
        'use server'
        const result = await syncOrderPurchaseCost(params.orderNumber)
        revalidatePath(`/dashboard/sales/daraz/order-report/${params.orderNumber}`)
    }

    // Calculate totals for display
    const totalPurchaseCost = order.items.reduce((sum: number, item: any) => sum + (item.purchase_price || 0), 0)
    const totalRevenue = order.price || 0
    // Note: order.price in daraz_orders usually means the total amount? 
    // Actually daraz_orders has `price` (Item Total) and `items_count` etc.
    // Let's rely on what the API returns. The View has `total_revenue`.
    // But here we are fetching raw `daraz_orders` row.
    // For single order, `price` is usually the total collected.

    // Revenue Breakdown (if available) - For now simple
    const revenue = order.price || 0
    const shipping = order.shipping_fee || 0
    const fees = order.daraz_fees || 0 // This is negative usually? Or we stored inclusive?
    // We stored `daraz_fees` as Positive number in sync logic (Sum of Abs).
    // So Profit = Revenue - Fees - Cost (roughly)

    // Actually, `daraz_order_report_view` calculates it nicely.
    // Let's just display what we have.

    const profit = revenue - (fees || 0) - totalPurchaseCost

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-zinc-950 p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/sales/daraz/order-report"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Order #{order.order_number}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {format(new Date(order.created_at), 'PPP p')} | {order.online_stores?.seller_account}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <form action={handleSingleSync}>
                        <Button type="submit" variant="outline" size="sm" className="gap-2">
                            <RefreshCw size={14} />
                            Resync Cost
                        </Button>
                    </form>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-white dark:bg-zinc-900 border-none shadow-sm">
                    <div className="text-sm text-gray-500">Total Revenue</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        Rs. {revenue.toLocaleString()}
                    </div>
                </Card>
                <Card className="p-4 bg-white dark:bg-zinc-900 border-none shadow-sm">
                    <div className="text-sm text-gray-500">Daraz Fees (Est)</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        - Rs. {(fees || 0).toLocaleString()}
                    </div>
                </Card>
                <Card className="p-4 bg-white dark:bg-zinc-900 border-none shadow-sm">
                    <div className="text-sm text-gray-500">Total Cost</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        - Rs. {totalPurchaseCost.toLocaleString()}
                    </div>
                </Card>
                <Card className={`p-4 border-none shadow-sm ${profit > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="text-sm text-gray-500">Net Profit</div>
                    <div className={`text-2xl font-bold ${profit > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        Rs. {profit.toLocaleString()}
                    </div>
                </Card>
            </div>

            {/* Items Table */}
            <Card className="overflow-hidden border-none shadow-md bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Order Items</h3>
                </div>
                <Table>
                    <TableHeader className="bg-gray-50 dark:bg-zinc-800">
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Linked ID</TableHead>
                            <TableHead className="text-right">Unit Cost</TableHead>
                            <TableHead className="text-right">Source</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item: any) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                <TableCell className="font-mono text-xs text-gray-500">{item.seller_sku}</TableCell>
                                <TableCell>
                                    {item.product_id ? (
                                        <Badge variant="outline" className="font-mono">{item.product_id}</Badge>
                                    ) : (
                                        <Badge variant="destructive">Unlinked</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    Rs. {(item.purchase_price || 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right text-xs text-gray-500">
                                    {item.purchase_price_source}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
