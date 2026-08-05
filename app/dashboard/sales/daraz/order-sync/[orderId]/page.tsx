'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, Truck, AlertCircle, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui-shim'
import { supabase } from '@/lib/supabase/client'

export default function OrderDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingFinance, setLoadingFinance] = useState(false)

    useEffect(() => {
        const fetchOrder = async () => {
            if (!params.orderId) return

            // Use the imported singleton supabase client
            const { data, error } = await supabase
                .from('daraz_orders')
                .select('*, online_stores(seller_account), items:daraz_order_items(*)')
                .eq('order_number', params.orderId)
                .single()

            if (error) {
                console.error('Error fetching order:', error)
            } else {
                setOrder(data)
            }
            setLoading(false)
        }
        fetchOrder()
    }, [params.orderId])

    // Finance Fetching Effect
    useEffect(() => {
        if (!order) return
        const status = (order.statuses?.[0] || order.status || 'pending').toLowerCase()

        // Fetch finance for delivered, completed, shipped, returned, and failed orders
        if (['delivered', 'completed', 'shipped', 'returned', 'failed'].includes(status)) {
            setLoadingFinance(true)
            const fetchFinance = async () => {
                try {
                    // Use order_id (integration ID) or order_number? API usually wants Order ID (trade_order_id).
                    // daraz_orders.order_id stores the actual Daraz ID.
                    const res = await fetch(`/api/daraz/finance?orderId=${order.order_id}&storeId=${order.store_id}&orderDate=${encodeURIComponent(order.daraz_created_at || order.created_at)}`)
                    const data = await res.json()

                    if (data.transactions) {
                        setTransactions(data.transactions)
                    }
                } catch (err) {
                    console.error('Failed to load finance details', err)
                } finally {
                    setLoadingFinance(false)
                }
            }
            fetchFinance()
        }
    }, [order])

    if (loading) {
        return <div className="p-8 text-center">Loading order details...</div>
    }

    if (!order) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
                <Link href="/dashboard/sales/daraz/order-sync" className="text-blue-600 hover:underline">
                    Back to Order List
                </Link>
            </div>
        )
    }

    const shipping = typeof order.address_shipping === 'string' ? JSON.parse(order.address_shipping || '{}') : order.address_shipping || {}

    // Get items from either daraz_order_items table or items_detail JSON field
    let items = []
    if (order.items && order.items.length > 0) {
        // Items from daraz_order_items table (manual/CSV orders)
        items = order.items.map((item: any) => ({
            name: item.product_name,
            sku: item.seller_sku,
            shop_sku: item.seller_sku,
            status: item.status || order.order_status || 'pending',
            item_price: item.amount,
            qty: item.quantity,
            shipping_amount: 0,
            shipping_fee_original: 0,
            shipping_fee_discount_platform: 0,
            shipping_fee_discount_seller: 0,
            free_shipping_max_fee: 0,
            voucher_platform: 0,
            voucher_seller: 0,
            commission_amount: 0,
            payment_fee: 0,
            handling_fee: 0,
            lazada_coin_discount: 0,
            tax_amount: 0
        }))
    } else {
        // Items from items_detail JSON (API synced orders)
        const itemsDetail = typeof order.items_detail === 'string' ? JSON.parse(order.items_detail || '[]') : order.items_detail || []
        items = itemsDetail
    }

    const status = (order.statuses?.[0] || order.status || 'pending').toLowerCase()

    // Group items by SKU
    const groupedItemsMap = new Map<string, any>()
    items.forEach((item: any) => {
        const key = `${item.sku}_${item.shop_sku}`
        if (groupedItemsMap.has(key)) {
            const existing = groupedItemsMap.get(key)
            existing.qty += (item.qty || 1)
        } else {
            groupedItemsMap.set(key, { ...item, qty: item.qty || 1 })
        }
    })
    const groupedItems = Array.from(groupedItemsMap.values())

    // Status Badge Helper
    const StatusBadge = ({ status }: { status: string }) => {
        let color = 'bg-gray-100 text-gray-800'
        let icon = <Clock size={14} />

        if (['pending', 'unpaid'].includes(status)) { color = 'bg-yellow-100 text-yellow-800'; icon = <Clock size={14} /> }
        if (['packed', 'ready_to_ship'].includes(status)) { color = 'bg-blue-100 text-blue-800'; icon = <Package size={14} /> }
        if (['shipped'].includes(status)) { color = 'bg-indigo-100 text-indigo-800'; icon = <Truck size={14} /> }
        if (['delivered'].includes(status)) { color = 'bg-green-100 text-green-800'; icon = <CheckCircle2 size={14} /> }
        if (['canceled', 'failed', 'returned'].includes(status)) { color = 'bg-red-100 text-red-800'; icon = <XCircle size={14} /> }

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color} capitalize`}>
                {icon}
                {status}
            </span>
        )
    }

    // Helper to get fee from transactions array
    const getFinanceTotal = (feeTypeKeywords: string[]) => {
        if (!transactions || !transactions.length) return 0

        const total = transactions
            .filter(t => {
                const name = (t.fee_name || '').toLowerCase()
                const type = (t.transaction_type || t.fee_type || '').toLowerCase()
                return feeTypeKeywords.some(k => name.includes(k) || type.includes(k))
            })
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount || 0)), 0)

        return total
    }

    const hasFinance = transactions.length > 0
    // Debug log if we have finance data
    if (hasFinance) {
        console.log('Finance Data:', transactions)
    }

    // Fallback Calculation (Old Text)
    const calculateTotal = (field: string) => {
        return items.reduce((sum: number, item: any) => sum + (parseFloat(item[field] || 0)), 0)
    }

    // --- Calculated Financial Values ---
    const isFinanceVisible = ['delivered', 'completed', 'shipped', 'returned', 'failed'].includes(status)
    const isDelivered = status === 'delivered' // Keep for backwards compatibility if needed, but likely replace usages

    // 1. Product Price (Always from Items)
    const val_price = calculateTotal('item_price')

    // 2. Shipping Fee (Buyer) (Always from Items)
    const val_shipping_buyer = calculateTotal('shipping_amount')

    // 3. Shipping Fee (Original)
    const val_shipping_original = calculateTotal('shipping_fee_original')

    // 4. Shipping Fee Discount (Always from Items)
    const val_shipping_discount = items.reduce((sum: number, i: any) => sum + (parseFloat(i.shipping_fee_discount_platform || 0) + parseFloat(i.shipping_fee_discount_seller || 0)), 0)

    // 5. Free Shipping Max Fee (Fallback: 4% + 13% VAT) - Show only if delivered
    const val_free_ship_raw = calculateTotal('free_shipping_max_fee')
    const val_free_ship = isFinanceVisible ? ((val_free_ship_raw > 0) ? val_free_ship_raw : (val_price * 0.04 * 1.13)) : 0

    // 6. Co-funded Voucher (Fallback: 3%) - Show only if delivered
    const val_voucher_raw = items.reduce((sum: number, i: any) => sum + (parseFloat(i.voucher_platform || 0) + parseFloat(i.voucher_seller || 0)), 0)
    const val_voucher = isFinanceVisible ? ((val_voucher_raw > 0) ? val_voucher_raw : (val_price * 0.03)) : 0

    // 7. Fees (Finance API or Fallback)
    // Commission Fee: Show only if delivered (per user request)
    const val_commission_raw = hasFinance ? getFinanceTotal(['commission']) : calculateTotal('commission_amount')
    const val_commission = isFinanceVisible ? val_commission_raw : 0

    const val_payment = hasFinance ? getFinanceTotal(['payment fee']) : calculateTotal('payment_fee')
    const val_handling = hasFinance ? getFinanceTotal(['handling fee']) : calculateTotal('handling_fee')
    const val_coin = hasFinance ? getFinanceTotal(['coin']) : parseFloat(calculateTotal('lazada_coin_discount') || '0')
    const val_tax = hasFinance ? getFinanceTotal(['tax', 'vat', 'wht']) : calculateTotal('tax_amount')

    // Grand Total Calculation (User Formula)
    // Grand Total = Product Price - Free Shipping - Voucher - Commission - Payment - Handling - Coins - Tax
    const grand_total = (
        val_price
        - val_free_ship
        - val_voucher
        - val_commission
        - val_payment
        - val_handling
        - val_coin
        - val_tax
    )

    // Analysis Percentages
    // Combined Fees: Show only if delivered (per user request)
    const val_combined_fees_raw = val_free_ship + val_voucher + val_commission + val_payment + val_handling + val_coin + val_tax
    const val_combined_fees = isFinanceVisible ? val_combined_fees_raw : 0

    const pct_commission = val_price > 0 ? ((val_commission / val_price) * 100).toFixed(2) : '0.00'
    const pct_combined = val_price > 0 ? ((val_combined_fees / val_price) * 100).toFixed(2) : '0.00'

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-zinc-900 overflow-hidden">
            {/* Compact Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 px-3 py-1.5 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/sales/daraz/order-sync"
                        className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded transition-colors text-gray-500"
                    >
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-sm font-bold flex items-center gap-2">
                            Order #{order.order_number}
                            <StatusBadge status={status} />
                        </h1>
                        <p className="text-[10px] text-gray-500">
                            Placed on {new Date(order.daraz_created_at || order.created_at).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="max-w-5xl mx-auto space-y-4">

                    {/* Key Dates (Conditional) */}
                    {(status === 'delivered' || status === 'failed' || status === 'returned') && (
                        <Card>
                            <CardContent className="p-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {status === 'delivered' && items[0]?.updated_at && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide">Delivered Date</div>
                                            <div className="text-xs font-medium">{new Date(items[0].updated_at).toLocaleString()}</div>
                                        </div>
                                    )}
                                    {(status === 'failed' || status === 'returned') && items[0]?.updated_at && (
                                        <div>
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{status === 'returned' ? 'Return' : 'Failed'} Date</div>
                                            <div className="text-xs font-medium">{new Date(items[0].updated_at).toLocaleString()}</div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Left Col: Details */}
                        <div className="md:col-span-2 space-y-4">
                            {/* Items List */}
                            <Card>
                                <CardHeader className="px-3 py-2 border-b dark:border-zinc-800">
                                    <CardTitle className="text-xs font-bold uppercase text-gray-600">Items ({items.length})</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="relative overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-gray-50 dark:bg-zinc-800 border-b dark:border-zinc-800">
                                                <tr>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-gray-500">Product</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-gray-500">SKU</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-center text-gray-500">Qty</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-center text-gray-500">Status</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-right text-gray-500">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                                {groupedItems.map((item: any, i: number) => (
                                                    <tr key={i} className="bg-white dark:bg-zinc-900">
                                                        <td className="px-3 py-2">
                                                            <div className="text-[11px] font-medium text-gray-900 dark:text-white">{item.name}</div>
                                                            <div className="text-[9px] text-gray-500">Shop SKU: {item.shop_sku}</div>
                                                        </td>
                                                        <td className="px-3 py-2 font-mono text-[10px] text-gray-500">
                                                            {item.sku}
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-bold text-[11px]">
                                                            {item.qty}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-[11px]">
                                                            {item.item_price}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 dark:bg-zinc-800/50">
                                                <tr>
                                                    <td colSpan={4} className="px-3 py-2 text-right text-[10px] uppercase font-bold text-gray-500">Total Amount</td>
                                                    <td className="px-3 py-2 text-right text-[11px] font-bold">{order.price}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Financial Breakdown (Detailed) */}
                            {isFinanceVisible && (
                                <>
                                    <Card>
                                        <CardHeader className="px-3 py-2 border-b dark:border-zinc-800 flex flex-row items-center justify-between">
                                            <CardTitle className="text-xs font-bold uppercase text-gray-600">Financial Breakdown</CardTitle>
                                            {loadingFinance && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            <div className="space-y-1">
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Product Price (Paid by Buyer)</span>
                                                    <span className="font-mono">{val_price.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Shipping Fee (Paid by Buyer)</span>
                                                    <span className="font-mono">{val_shipping_buyer.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Shipping Fee (Original)</span>
                                                    <span className="font-mono">{val_shipping_original.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Shipping Fee Discount</span>
                                                    <span className="font-mono text-green-600">
                                                        -{val_shipping_discount.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Free Shipping Max Fee</span>
                                                    <span className="font-mono text-red-600">
                                                        -{val_free_ship.toFixed(2)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Co-funded Voucher Max</span>
                                                    <span className="font-mono text-red-600">
                                                        -{val_voucher.toFixed(2)}
                                                    </span>
                                                </div>

                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Commission Fee</span>
                                                    <span className="font-mono text-red-600">-{val_commission.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Payment Fee</span>
                                                    <span className="font-mono text-red-600">-{val_payment.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Handling Fee</span>
                                                    <span className="font-mono text-red-600">-{val_handling.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Daraz Coins Discount Participation Fee</span>
                                                    <span className="font-mono text-red-600">-{val_coin.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">General Sales Tax Withholding</span>
                                                    <span className="font-mono text-red-600">-{val_tax.toFixed(2)}</span>
                                                </div>

                                                <Separator className="my-2" />

                                                <div className="flex justify-between py-1 font-bold text-sm bg-gray-50 dark:bg-zinc-800/50 px-2 rounded">
                                                    <span>Grand Total</span>
                                                    <span>{grand_total.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Fee Analysis Box */}
                                    <Card>
                                        <CardHeader className="px-3 py-2 border-b dark:border-zinc-800">
                                            <CardTitle className="text-xs font-bold uppercase text-gray-600">Fee Analysis</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-[10px] text-gray-500 mb-1">Commission Fee</div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{val_commission.toFixed(2)}</span>
                                                        <span className="text-[10px] text-gray-500">({pct_commission}%)</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-500 mb-1">Combined Fees</div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-lg font-bold text-red-600">{val_combined_fees.toFixed(2)}</span>
                                                        <span className="text-[10px] text-gray-500">({pct_combined}%)</span>
                                                    </div>
                                                    <p className="text-[9px] text-gray-400 mt-0.5">
                                                        Includes: Vouchers, Commission, Payment, Handling, Coins, Tax
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>

                        {/* Right Col: Info */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="px-3 py-2 border-b dark:border-zinc-800">
                                    <CardTitle className="text-xs font-bold uppercase text-gray-600">Customer & Shipping</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 space-y-3">
                                    <div>
                                        <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide flex items-center gap-1">
                                            <MapPin size={10} /> Receiver
                                        </div>
                                        <div className="text-[11px] font-medium">{order.shipping_name}</div>
                                        <div className="text-[11px] text-gray-600 leading-tight mt-0.5">{order.shipping_address}</div>
                                        <div className="text-[11px] text-gray-600">{order.shipping_city} {order.shipping_postcode}</div>
                                        {order.shipping_phone && (
                                            <div className="mt-1 font-mono text-[10px] text-gray-500 bg-gray-50 inline-block px-1 rounded">
                                                {order.shipping_phone}
                                            </div>
                                        )}
                                    </div>

                                    <Separator />

                                    <div>
                                        <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide flex items-center gap-1">
                                            <Package size={10} /> Tracking
                                        </div>
                                        <div className="text-[11px] font-mono bg-gray-100 dark:bg-zinc-800 p-1.5 rounded text-center">
                                            {order.tracking_code || 'N/A'}
                                        </div>
                                        {['pending', 'unpaid'].includes(status) && (
                                            <p className="text-[10px] text-orange-600 mt-1">
                                                Tracking available after packing.
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="px-3 py-2 border-b dark:border-zinc-800">
                                    <CardTitle className="text-xs font-bold uppercase text-gray-600">Store Info</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 text-[11px]">
                                    <div className="font-medium">{order.online_stores?.seller_account || 'Unknown Store'}</div>
                                    <div className="text-gray-500 text-[10px] mt-0.5">Store ID: {order.store_id}</div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
