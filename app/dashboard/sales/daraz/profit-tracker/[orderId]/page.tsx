'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, MapPin, Truck, AlertCircle, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Separator } from '@/components/ui-shim'
import { supabase } from '@/lib/supabase/client'

export default function ProfitTrackerOrderPage() {
    const params = useParams()
    const router = useRouter()
    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingFinance, setLoadingFinance] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState('')

    useEffect(() => {
        const fetchOrder = async () => {
            if (!params.orderId) return

            // Use the imported singleton supabase client
            // Query by the internal Table ID (order_primary_id) since the route is /order/[id]
            const { data, error } = await supabase
                .from('daraz_orders')
                .select('*, online_stores(seller_account), items:daraz_order_items(*, product:products(product_id))')
                .eq('id', params.orderId) // Query by ID here, NOT order_number
                .single()

            if (error) {
                console.error('Error fetching order:', error)
                setLoading(false)
                return
            }

            // Fetch purchase costs from inventory_price_reports_view
            if (data && data.items && data.items.length > 0) {
                const productIds = data.items
                    .map((item: any) => item.product?.product_id)
                    .filter((id: any) => id)

                if (productIds.length > 0) {
                    const { data: priceData } = await supabase
                        .from('inventory_price_reports_view')
                        .select('product_id, product_code, last_price, est_price')
                        .in('product_code', productIds)

                    // Create a price map
                    const priceMap: Record<string, { last_price: number | null, est_price: number | null }> = {}
                    priceData?.forEach((p: any) => {
                        priceMap[p.product_code] = {
                            last_price: p.last_price,
                            est_price: p.est_price
                        }
                    })

                    // Enrich items with purchase cost
                    data.items = data.items.map((item: any) => {
                        const productCode = item.product?.product_id
                        const priceInfo = priceMap[productCode]

                        // Priority: Locked (DB) -> Last Price -> Est Price -> 0
                        let purchasePrice = 0
                        let purchasePriceSource = 'Not Set'

                        if (item.purchase_cost && item.purchase_cost > 0) {
                            purchasePrice = item.purchase_cost
                            purchasePriceSource = 'Locked (Saved)'
                        } else {
                            purchasePrice = priceInfo?.last_price || priceInfo?.est_price || 0
                            purchasePriceSource = purchasePrice > 0
                                ? (priceInfo?.last_price ? 'Last Price' : 'Est. Price')
                                : 'Not Set'
                        }

                        return {
                            ...item,
                            purchase_price: purchasePrice,
                            purchase_price_source: purchasePriceSource
                        }
                    })
                }
            }

            setOrder(data)
            setLoading(false)
        }
        fetchOrder()
    }, [params.orderId])

    // Finance Fetching Effect
    useEffect(() => {
        if (!order) return
        const status = (order.statuses?.[0] || order.order_status || 'pending').toLowerCase() // Map order_status

        // Fetch finance for delivered, completed, shipped, returned, and failed orders
        if (['delivered', 'completed', 'shipped', 'returned', 'failed', 'customer return delivered'].includes(status)) {
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

    // Sync Handler
    const handleSync = async () => {
        if (!order?.order_number) return

        setIsSyncing(true)
        setSyncMessage('Syncing...')
        try {
            const { syncOrderPurchaseCost } = await import('@/features/sales/actions/report-actions')
            await syncOrderPurchaseCost(order.order_number)
            setSyncMessage('✓ Synced! Refresh page to see changes.')
            setTimeout(() => setSyncMessage(''), 3000)
        } catch (error: any) {
            setSyncMessage(`Error: ${error.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center">Loading order details...</div>
    }

    if (!order) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
                <Link href="/dashboard/sales/daraz/profit-tracker" className="text-blue-600 hover:underline">
                    Back to Profit Tracker
                </Link>
            </div>
        )
    }



    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading order details...</div>
    }

    if (!order) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
                <Link href="/dashboard/sales/daraz/profit-tracker" className="text-blue-600 hover:underline">
                    Back to Profit Tracker
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
            status: (item.item_status || item.status || order.order_status || 'pending').toLowerCase(),
            item_price: item.amount,
            qty: item.quantity,
            matched_product_code: item.product?.product_id || null,
            purchase_price: item.purchase_price || 0,
            purchase_price_source: item.purchase_price_source || 'Not Set',
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
            tax_amount: 0,
            updated_at: item.updated_at
        }))
    } else {
        // Items from items_detail JSON (API synced orders)
        const itemsDetail = typeof order.items_detail === 'string' ? JSON.parse(order.items_detail || '[]') : order.items_detail || []
        items = itemsDetail
    }

    // Filter Items for Profit Tracker: Show Only Delivered Items
    // If an item is returned (partial return), it should not be in the profit calc/list
    items = items.filter((i: any) => {
        const iStatus = (i.status || '').toLowerCase()
        return iStatus === 'delivered' || (!iStatus && order.order_status === 'Delivered')
    })

    const status = (order.statuses?.[0] || order.order_status || 'pending').toLowerCase()

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
            .reduce((sum, t) => sum - parseFloat(t.amount || 0), 0)

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
    const isFinanceVisible = ['delivered', 'completed', 'shipped', 'returned', 'failed', 'customer return delivered'].includes(status)
    const isDelivered = status === 'delivered' || status === 'customer return delivered' // Allow calc for mixed status orders

    // 1. Product Price (Always from Items)
    // 1. Product Price (Always from Items - Multiply by Quantity)
    const val_price = items.reduce((sum: number, item: any) => sum + ((parseFloat(item.item_price || 0)) * (item.qty || 1)), 0)

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
                        href="/dashboard/sales/daraz/profit-tracker"
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
                {/* Sync Button */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Fees'}
                    </button>
                    {syncMessage && (
                        <span className="text-xs text-gray-600">{syncMessage}</span>
                    )}
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
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-center text-gray-500">Linked ID</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-center text-gray-500">Qty</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-center text-gray-500">Status</th>
                                                    <th className="px-3 py-2 text-[9px] font-bold uppercase text-right text-gray-500">Purchase Cost</th>
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
                                                        <td className="px-3 py-2 text-center">
                                                            {item.matched_product_code ? (
                                                                <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1 py-0.5 rounded border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                                                                    {item.matched_product_code}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-300 text-[10px]">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-center font-bold text-[11px]">
                                                            {item.qty}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-[11px] text-red-600">
                                                            {item.purchase_price ? `Rs. ${item.purchase_price.toLocaleString()}` : '-'}
                                                            {item.purchase_price_source && (
                                                                <div className="text-[9px] text-gray-400 font-normal">{item.purchase_price_source}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-[11px]">
                                                            {item.item_price}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50 dark:bg-zinc-800/50">
                                                <tr>
                                                    <td colSpan={5} className="px-3 py-2 text-right text-[10px] uppercase font-bold text-gray-500">Total Amount</td>
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

                        {/* Right Col: Net Profit */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader className="px-3 py-2 border-b dark:border-zinc-800">
                                    <CardTitle className="text-xs font-bold uppercase text-gray-600">Net Profit</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3">
                                    {/* Calculations */}
                                    {(() => {
                                        // Only show Net Profit if Delivered (or mixed delivered)
                                        if (!isDelivered) {
                                            return (
                                                <div className="text-center py-6 text-gray-500 text-xs">
                                                    Profit calculation available for delivered orders only.
                                                </div>
                                            )
                                        }

                                        const val_receivable = grand_total

                                        // Calculate Total Fee (all Daraz fees combined)
                                        const val_total_fee = val_free_ship + val_voucher + val_commission + val_payment + val_handling + val_coin + val_tax

                                        const val_other_fee_fixed = 30
                                        const val_total_purchase_cost = items.reduce((sum: number, item: any) => sum + ((item.purchase_price || 0) * (item.qty || 1)), 0)

                                        // Net Profit = Receivable - Other Fee - Purchase Cost
                                        // (Total Fee already deducted in Receivable)
                                        const val_net_profit = val_receivable - val_other_fee_fixed - val_total_purchase_cost
                                        const val_profit_percent = val_receivable > 0 ? ((val_net_profit / val_receivable) * 100) : 0

                                        return (
                                            <div className="space-y-2">
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Receivable Amount</span>
                                                    <span className="font-mono">{val_receivable.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Total Fee (Daraz)</span>
                                                    <span className="font-mono text-red-600">-{val_total_fee.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Other Fee</span>
                                                    <span className="font-mono text-red-600">-{val_other_fee_fixed.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-zinc-800 text-[11px]">
                                                    <span className="text-gray-600">Purchase Cost</span>
                                                    <span className="font-mono text-red-600">-{val_total_purchase_cost.toFixed(2)}</span>
                                                </div>

                                                <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-zinc-700 items-center">
                                                    <span className="font-bold text-gray-700 dark:text-gray-300 text-xs uppercase">Net Profit</span>
                                                    <span className={`font-mono font-bold text-sm ${val_net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {val_net_profit.toFixed(2)}
                                                    </span>
                                                </div>

                                                <div className={`mt-2 p-2 rounded text-center text-xs font-bold ${val_net_profit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                    Profit Margin: {val_profit_percent.toFixed(2)}%
                                                </div>

                                                {val_total_purchase_cost === 0 && (
                                                    <div className="mt-2 text-[10px] text-orange-600 text-center font-medium bg-orange-50 dark:bg-orange-900/10 p-1.5 rounded border border-orange-100 dark:border-orange-900/20">
                                                        (Purchase cost need to calculate)
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
