'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft,
    Package,
    MapPin,
    Truck,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    ExternalLink,
    Copy,
    Check,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Store,
    Receipt,
    Percent,
    ShieldAlert,
    FileText,
    ShoppingBag,
    Tag,
    ChevronRight,
    HelpCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Helper to reliably parse currency amounts that might include commas or be strings/numbers
const parseAmount = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    const clean = String(val).replace(/,/g, '').trim()
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? 0 : parsed
}

// Format currency as Rs. 1,234.56
const formatCurrency = (val: number | string, showRs = true) => {
    const num = parseAmount(val)
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
    return showRs ? `Rs. ${formatted}` : formatted
}

export default function ProfitTrackerOrderPage() {
    const params = useParams()
    const router = useRouter()
    const orderParam = params?.orderId as string

    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState<any[]>([])
    const [loadingFinance, setLoadingFinance] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState('')
    const [copiedOrderNo, setCopiedOrderNo] = useState(false)

    // Fetch order data
    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderParam) return

            // Query by ID first (uuid), or fallback to order_number
            let { data, error } = await supabase
                .from('daraz_orders')
                .select('*, online_stores(seller_account), items:daraz_order_items(*, product:products(product_id))')
                .eq('id', orderParam)
                .maybeSingle()

            if (!data) {
                const fallback = await supabase
                    .from('daraz_orders')
                    .select('*, online_stores(seller_account), items:daraz_order_items(*, product:products(product_id))')
                    .eq('order_number', orderParam)
                    .maybeSingle()
                data = fallback.data
                error = fallback.error
            }

            if (error || !data) {
                console.error('Error fetching order:', error)
                setLoading(false)
                return
            }

            // Fetch purchase costs from inventory_price_reports_view
            if (data.items && data.items.length > 0) {
                const productIds = data.items
                    .map((item: any) => item.product?.product_id)
                    .filter((id: any) => id)

                if (productIds.length > 0) {
                    const { data: priceData } = await supabase
                        .from('inventory_price_reports_view')
                        .select('product_id, product_code, last_price, est_price')
                        .in('product_code', productIds)

                    const priceMap: Record<string, { last_price: number | null, est_price: number | null }> = {}
                    priceData?.forEach((p: any) => {
                        priceMap[p.product_code] = {
                            last_price: p.last_price,
                            est_price: p.est_price
                        }
                    })

                    data.items = data.items.map((item: any) => {
                        const productCode = item.product?.product_id
                        const priceInfo = priceMap[productCode]

                        let purchasePrice = 0
                        let purchasePriceSource = 'Not Set'

                        if (item.purchase_cost && item.purchase_cost > 0) {
                            purchasePrice = parseAmount(item.purchase_cost)
                            purchasePriceSource = 'Locked (Saved)'
                        } else {
                            purchasePrice = parseAmount(priceInfo?.last_price || priceInfo?.est_price || 0)
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
    }, [orderParam])

    // Finance Fetching Effect
    useEffect(() => {
        if (!order) return
        const status = (order.statuses?.[0] || order.order_status || 'pending').toLowerCase()

        if (['delivered', 'completed', 'shipped', 'returned', 'failed', 'customer return delivered'].includes(status)) {
            setLoadingFinance(true)
            const fetchFinance = async () => {
                try {
                    const res = await fetch(`/api/daraz/finance?orderId=${order.order_id || order.order_number}&storeId=${order.store_id}&orderDate=${encodeURIComponent(order.daraz_created_at || order.created_at || '')}`)
                    const data = await res.json()

                    if (data?.transactions) {
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
        setSyncMessage('Syncing fees...')
        try {
            const { syncOrderPurchaseCost } = await import('@/features/sales/actions/report-actions')
            const result = await syncOrderPurchaseCost(order.order_number)
            setSyncMessage('✓ Synced!')
            toast.success(`Fees synced successfully: ${result?.feeResult || 'Updated'}`)

            // Refetch finance transactions
            if (order.store_id) {
                setLoadingFinance(true)
                const res = await fetch(`/api/daraz/finance?orderId=${order.order_id || order.order_number}&storeId=${order.store_id}&orderDate=${encodeURIComponent(order.daraz_created_at || order.created_at || '')}`)
                const data = await res.json()
                if (data?.transactions) {
                    setTransactions(data.transactions)
                }
                setLoadingFinance(false)
            }

            setTimeout(() => setSyncMessage(''), 3000)
        } catch (error: any) {
            setSyncMessage(`Error: ${error.message}`)
            toast.error(`Sync failed: ${error.message}`)
        } finally {
            setIsSyncing(false)
        }
    }

    const copyOrderNumber = () => {
        if (!order?.order_number) return
        navigator.clipboard.writeText(order.order_number)
        setCopiedOrderNo(true)
        toast.info('Order number copied to clipboard')
        setTimeout(() => setCopiedOrderNo(false), 2000)
    }

    // Status Badge Helper
    const StatusBadge = ({ status }: { status: string }) => {
        const s = (status || '').toLowerCase()
        let color = 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
        let icon = <Clock className="w-3.5 h-3.5" />

        if (['pending', 'unpaid'].includes(s)) {
            color = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
            icon = <Clock className="w-3.5 h-3.5" />
        } else if (['packed', 'ready_to_ship'].includes(s)) {
            color = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800'
            icon = <Package className="w-3.5 h-3.5" />
        } else if (['shipped'].includes(s)) {
            color = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800'
            icon = <Truck className="w-3.5 h-3.5" />
        } else if (['delivered'].includes(s)) {
            color = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
            icon = <CheckCircle2 className="w-3.5 h-3.5" />
        } else if (['canceled', 'failed', 'returned', 'customer return delivered'].includes(s)) {
            color = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
            icon = <XCircle className="w-3.5 h-3.5" />
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color} capitalize`}>
                {icon}
                {status || 'Unknown'}
            </span>
        )
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Loading order details...</p>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Order Not Found</h2>
                    <p className="text-sm text-slate-500 mt-1">The requested order could not be loaded or was deleted.</p>
                </div>
                <Link
                    href="/dashboard/sales/daraz/profit-tracker"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Profit Tracker
                </Link>
            </div>
        )
    }

    // Process Items
    const rawItemsDetail = typeof order.items_detail === 'string'
        ? JSON.parse(order.items_detail || '[]')
        : order.items_detail || []

    let items: any[] = []
    if (order.items && order.items.length > 0) {
        items = order.items.map((item: any, idx: number) => {
            const detailMatch = rawItemsDetail.find((d: any) =>
                d.sku === item.seller_sku || d.shop_sku === item.seller_sku || String(d.order_item_id) === String(item.id)
            ) || rawItemsDetail[idx] || {}

            return {
                name: item.product_name || detailMatch.name || 'Unnamed Product',
                sku: item.seller_sku || detailMatch.sku || '-',
                shop_sku: detailMatch.shop_sku || item.seller_sku || '-',
                status: (item.item_status || item.status || detailMatch.status || order.order_status || 'pending').toLowerCase(),
                item_price: parseAmount(item.amount || detailMatch.item_price || 0),
                qty: item.quantity || detailMatch.qty || 1,
                matched_product_code: item.product?.product_id || null,
                purchase_price: parseAmount(item.purchase_price || 0),
                purchase_price_source: item.purchase_price_source || 'Not Set',
                product_main_image: detailMatch.product_main_image || null,
                product_detail_url: detailMatch.product_detail_url || null,
                variation: detailMatch.variation || null,
                shipping_amount: parseAmount(detailMatch.shipping_amount || 0),
                shipping_fee_original: parseAmount(detailMatch.shipping_fee_original || 0),
                shipping_fee_discount_platform: parseAmount(detailMatch.shipping_fee_discount_platform || 0),
                shipping_fee_discount_seller: parseAmount(detailMatch.shipping_fee_discount_seller || 0),
                free_shipping_max_fee: parseAmount(detailMatch.free_shipping_max_fee || 0),
                voucher_platform: parseAmount(detailMatch.voucher_platform || 0),
                voucher_seller: parseAmount(detailMatch.voucher_seller || 0),
                commission_amount: parseAmount(detailMatch.commission_amount || 0),
                payment_fee: parseAmount(detailMatch.payment_fee || 0),
                handling_fee: parseAmount(detailMatch.handling_fee || 0),
                lazada_coin_discount: parseAmount(detailMatch.lazada_coin_discount || 0),
                tax_amount: parseAmount(detailMatch.tax_amount || 0),
                updated_at: item.updated_at || detailMatch.updated_at
            }
        })
    } else {
        items = rawItemsDetail.map((detail: any) => ({
            name: detail.name || 'Unnamed Product',
            sku: detail.sku || '-',
            shop_sku: detail.shop_sku || '-',
            status: (detail.status || order.order_status || 'pending').toLowerCase(),
            item_price: parseAmount(detail.item_price || 0),
            qty: detail.qty || 1,
            matched_product_code: null,
            purchase_price: 0,
            purchase_price_source: 'Not Set',
            product_main_image: detail.product_main_image || null,
            product_detail_url: detail.product_detail_url || null,
            variation: detail.variation || null,
            shipping_amount: parseAmount(detail.shipping_amount || 0),
            shipping_fee_original: parseAmount(detail.shipping_fee_original || 0),
            shipping_fee_discount_platform: parseAmount(detail.shipping_fee_discount_platform || 0),
            shipping_fee_discount_seller: parseAmount(detail.shipping_fee_discount_seller || 0),
            free_shipping_max_fee: parseAmount(detail.free_shipping_max_fee || 0),
            voucher_platform: parseAmount(detail.voucher_platform || 0),
            voucher_seller: parseAmount(detail.voucher_seller || 0),
            commission_amount: parseAmount(detail.commission_amount || 0),
            payment_fee: parseAmount(detail.payment_fee || 0),
            handling_fee: parseAmount(detail.handling_fee || 0),
            lazada_coin_discount: parseAmount(detail.lazada_coin_discount || 0),
            tax_amount: parseAmount(detail.tax_amount || 0),
            updated_at: detail.updated_at
        }))
    }

    // Filter Items for Profit Tracker: Show delivered items
    const orderStatusRaw = (order.statuses?.[0] || order.order_status || 'pending').toLowerCase()
    const deliveredItems = items.filter((i: any) => {
        const iStatus = (i.status || '').toLowerCase()
        return iStatus === 'delivered' || (!iStatus && orderStatusRaw === 'delivered')
    })
    const displayItems = deliveredItems.length > 0 ? deliveredItems : items

    // Group items by SKU
    const groupedItemsMap = new Map<string, any>()
    displayItems.forEach((item: any) => {
        const key = `${item.sku}_${item.shop_sku}`
        if (groupedItemsMap.has(key)) {
            const existing = groupedItemsMap.get(key)
            existing.qty += (item.qty || 1)
        } else {
            groupedItemsMap.set(key, { ...item, qty: item.qty || 1 })
        }
    })
    const groupedItems = Array.from(groupedItemsMap.values())

    // Finance Calculations
    const hasFinance = transactions.length > 0
    const isFinanceVisible = ['delivered', 'completed', 'shipped', 'returned', 'failed', 'customer return delivered'].includes(orderStatusRaw)
    const isDelivered = orderStatusRaw === 'delivered' || orderStatusRaw === 'customer return delivered'

    const getFinanceTotal = (feeTypeKeywords: string[], excludeKeywords: string[] = []) => {
        if (!transactions || !transactions.length) return 0
        return transactions
            .filter(t => {
                const name = (t.fee_name || '').toLowerCase()
                const type = (t.transaction_type || t.fee_type || '').toLowerCase()
                const matches = feeTypeKeywords.some(k => name.includes(k) || type.includes(k))
                const excluded = excludeKeywords.some(k => name.includes(k) || type.includes(k))
                return matches && !excluded
            })
            .reduce((sum, t) => sum - parseAmount(t.amount), 0)
    }

    const calculateTotal = (field: string) => {
        return displayItems.reduce((sum: number, item: any) => sum + parseAmount(item[field]), 0)
    }

    // 1. PRODUCT PRICE (Paid by Buyer)
    // CRITICAL FIX: Use parseAmount to properly handle comma thousands format (e.g. "2,189.00" -> 2189)
    const financeItemPrice = hasFinance
        ? transactions.filter(t => {
            const name = (t.fee_name || '').toLowerCase()
            return name.includes('product price paid by buyer') || name.includes('item price credit')
        }).reduce((sum, t) => sum + parseAmount(t.amount), 0)
        : 0

    const fallbackItemPrice = displayItems.reduce((sum: number, item: any) => sum + (parseAmount(item.item_price) * (item.qty || 1)), 0)
    const val_price = financeItemPrice > 0 ? financeItemPrice : (fallbackItemPrice > 0 ? fallbackItemPrice : parseAmount(order.price))

    // 2. Shipping Fee (Buyer)
    const val_shipping_buyer = calculateTotal('shipping_amount')

    // 3. Shipping Fee (Original)
    const val_shipping_original = hasFinance
        ? getFinanceTotal(['shipping fee'], ['delivery failed', 'discount'])
        : calculateTotal('shipping_fee_original')

    // 4. Shipping Fee Discount
    const val_shipping_discount = hasFinance
        ? transactions.filter(t => (t.fee_name || '').toLowerCase().includes('shipping fee discount')).reduce((sum, t) => sum + parseAmount(t.amount), 0)
        : displayItems.reduce((sum: number, i: any) => sum + (parseAmount(i.shipping_fee_discount_platform) + parseAmount(i.shipping_fee_discount_seller)), 0)

    // 5. Delivery Failed / Re-attempt Fee
    const deliveryFailedTransactions = hasFinance
        ? transactions.filter(t =>
            (t.transaction_type || '').toLowerCase().includes('delivery failed') ||
            String(t.fee_type) === '172' ||
            ((t.fee_name || '').toLowerCase().includes('shipping fee') && (t.transaction_type || '').toLowerCase().includes('failed'))
        )
        : []
    const val_shipping_delivery_failed = deliveryFailedTransactions.reduce((sum, t) => sum - parseAmount(t.amount), 0)

    // 6. Free Shipping Max Fee (Fallback: 4% + 13% VAT)
    const val_free_ship_raw = hasFinance ? getFinanceTotal(['free shipping', 'free_shipping']) : calculateTotal('free_shipping_max_fee')
    const val_free_ship = isFinanceVisible ? ((val_free_ship_raw > 0) ? val_free_ship_raw : (val_price * 0.04 * 1.13)) : 0

    // 7. Co-funded Voucher (Fallback: 3%)
    const val_voucher_raw = hasFinance ? getFinanceTotal(['co-funded', 'cofunded', 'co_funded', 'voucher']) : displayItems.reduce((sum: number, i: any) => sum + (parseAmount(i.voucher_platform) + parseAmount(i.voucher_seller)), 0)
    const val_voucher = isFinanceVisible ? ((val_voucher_raw > 0) ? val_voucher_raw : (val_price * 0.03)) : 0

    // 8. Other standard fees
    const val_commission_raw = hasFinance ? getFinanceTotal(['commission']) : calculateTotal('commission_amount')
    const val_commission = isFinanceVisible ? val_commission_raw : 0
    const val_payment = hasFinance ? getFinanceTotal(['payment fee']) : calculateTotal('payment_fee')
    const val_handling = hasFinance ? getFinanceTotal(['handling fee']) : calculateTotal('handling_fee')
    const val_coin = hasFinance ? getFinanceTotal(['coin']) : calculateTotal('lazada_coin_discount')
    const val_tax = hasFinance ? getFinanceTotal(['tax', 'vat', 'wht']) : calculateTotal('tax_amount')

    // 9. Unexpected/Other Daraz fees
    const standardKeywords = [
        'product price paid by buyer', 'item price credit',
        'commission', 'payment fee', 'handling fee',
        'tax', 'vat', 'wht', 'withholding',
        'free shipping', 'free_shipping',
        'co-funded', 'cofunded', 'co_funded', 'voucher',
        'coin',
        'shipping fee', 'shipping fee discount'
    ]
    const unexpectedFeeTransactions = hasFinance
        ? transactions.filter(t => {
            const name = (t.fee_name || '').toLowerCase().trim()
            const type = (t.transaction_type || '').toLowerCase().trim()
            return !standardKeywords.some(k => name.includes(k) || type.includes(k))
        })
        : []
    const val_unexpected_fees = unexpectedFeeTransactions.reduce((sum, t) => sum - parseAmount(t.amount), 0)

    // Grand Total (Receivable Amount from Daraz Ledger)
    const grand_total = hasFinance
        ? transactions.reduce((sum, t) => sum + parseAmount(t.amount), 0)
        : (
            val_price
            - val_free_ship
            - val_voucher
            - val_commission
            - val_payment
            - val_handling
            - val_coin
            - val_tax
            - val_shipping_delivery_failed
            - val_unexpected_fees
        )

    const val_receivable = grand_total
    const val_total_fee = hasFinance
        ? Math.max(0, val_price - val_receivable)
        : (val_free_ship + val_voucher + val_commission + val_payment + val_handling + val_coin + val_tax + val_shipping_delivery_failed + val_unexpected_fees)

    const val_other_fee_fixed = 30
    const val_total_purchase_cost = displayItems.reduce((sum: number, item: any) => sum + (parseAmount(item.purchase_price) * (item.qty || 1)), 0)
    const val_net_profit = val_receivable - val_other_fee_fixed - val_total_purchase_cost
    const val_profit_percent = val_receivable > 0 ? ((val_net_profit / val_receivable) * 100) : 0
    const val_roi = val_total_purchase_cost > 0 ? ((val_net_profit / (val_total_purchase_cost + val_other_fee_fixed)) * 100) : 0

    const pct_commission = val_price > 0 ? ((val_commission / val_price) * 100).toFixed(2) : '0.00'
    const pct_combined = val_price > 0 ? ((val_total_fee / val_price) * 100).toFixed(2) : '0.00'

    const sellerAccount = order.online_stores?.seller_account || order.items?.[0]?.seller_account || 'Default Store'
    const placedDate = order.daraz_created_at || order.order_date || order.created_at
    const deliveredDate = order.delivered_at || displayItems[0]?.updated_at

    return (
        <div className="flex flex-col min-h-screen bg-slate-50/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 antialiased">
            {/* Top Bar - Clean, modern, narrow spacing with sidebar */}
            <div className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 px-4 py-2.5 shadow-xs">
                <div className="w-full max-w-[1600px] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/sales/daraz/profit-tracker"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-200 dark:border-zinc-800 shadow-2xs"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Profit Tracker</span>
                        </Link>

                        <div className="h-4 w-px bg-slate-200 dark:bg-zinc-800 hidden sm:block" />

                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                                Order
                            </span>
                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                                #{order.order_number}
                            </span>
                            <button
                                onClick={copyOrderNumber}
                                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Copy Order Number"
                            >
                                {copiedOrderNo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            <StatusBadge status={orderStatusRaw} />

                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-zinc-700">
                                <Store className="w-3 h-3 text-slate-500" />
                                {sellerAccount}
                            </span>
                        </div>
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center gap-2 ml-auto">
                        {placedDate && (
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden md:inline-flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Placed: {new Date(placedDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            </span>
                        )}

                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Syncing...' : 'Sync Fees'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Reduced side padding for narrow spacing next to sidebar */}
            <div className="flex-1 w-full max-w-[1600px] px-3 py-4 md:px-5 space-y-4">

                {/* Top Executive KPI Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {/* Card 1: Product Price (Paid by Buyer) */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Product Revenue</span>
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <ShoppingBag className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white">
                                {formatCurrency(val_price)}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                <span>Paid by Buyer</span>
                                {hasFinance && (
                                    <span className="inline-flex items-center px-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                                        API
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Receivable Amount */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Daraz Settlement</span>
                            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                                <DollarSign className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-1.5">
                            <div className={`text-base sm:text-lg font-bold font-mono ${val_receivable >= 0 ? 'text-sky-700 dark:text-sky-400' : 'text-rose-600'}`}>
                                {formatCurrency(val_receivable)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                {val_price > 0 ? `${((val_receivable / val_price) * 100).toFixed(1)}% of price` : 'Receivable'}
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Daraz Deductions */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Daraz Deductions</span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <Percent className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-base sm:text-lg font-bold font-mono text-amber-700 dark:text-amber-400">
                                -{formatCurrency(val_total_fee)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                {pct_combined}% deductions
                            </div>
                        </div>
                    </div>

                    {/* Card 4: Purchase Cost */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                        <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                            <span className="text-[11px] font-semibold uppercase tracking-wider">Purchase Cost</span>
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <Package className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-1.5">
                            <div className="text-base sm:text-lg font-bold font-mono text-purple-700 dark:text-purple-400">
                                -{formatCurrency(val_total_purchase_cost)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                {val_total_purchase_cost > 0 ? (displayItems[0]?.purchase_price_source || 'Item Cost') : 'Not mapped'}
                            </div>
                        </div>
                    </div>

                    {/* Card 5: Net Profit Hero Card */}
                    <div className={`col-span-2 md:col-span-1 rounded-xl p-3.5 border shadow-2xs hover:shadow-xs transition-shadow ${
                        val_net_profit >= 0
                            ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
                            : 'bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border-rose-200 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
                    }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider">Net Profit</span>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                val_net_profit >= 0
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-rose-500 text-white'
                            }`}>
                                {val_net_profit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            </div>
                        </div>
                        <div className="mt-1.5">
                            <div className={`text-base sm:text-lg font-black font-mono ${
                                val_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                                {val_net_profit >= 0 ? '+' : ''}{formatCurrency(val_net_profit)}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold mt-0.5">
                                <span className={val_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                                    Margin: {val_profit_percent.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Responsive Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                    {/* Left Column (Items & Settlement Breakdown) - 7 cols */}
                    <div className="lg:col-span-7 space-y-4">

                        {/* Order Items Table Card */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-slate-500" />
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                                        Ordered Items ({groupedItems.length})
                                    </h2>
                                </div>
                                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                                    Total: {formatCurrency(order.price)}
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-800/40 text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400">
                                            <th className="py-2.5 px-3">Product</th>
                                            <th className="py-2.5 px-3 text-center">SKU / Linked ID</th>
                                            <th className="py-2.5 px-2.5 text-center">Qty</th>
                                            <th className="py-2.5 px-3 text-center">Status</th>
                                            <th className="py-2.5 px-3 text-right">Purchase Cost</th>
                                            <th className="py-2.5 px-3 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/70">
                                        {groupedItems.map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="py-2.5 px-3 max-w-[280px]">
                                                    <div className="flex items-start gap-2.5">
                                                        {item.product_main_image ? (
                                                            <img
                                                                src={item.product_main_image}
                                                                alt={item.name}
                                                                className="w-9 h-9 rounded-md object-cover border border-slate-200 dark:border-zinc-700 shrink-0 bg-slate-100"
                                                                onError={(e) => {
                                                                    (e.target as HTMLElement).style.display = 'none'
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-slate-400">
                                                                <Package className="w-4 h-4" />
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                                                                {item.name}
                                                            </div>
                                                            {item.variation && (
                                                                <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                                                                    {item.variation}
                                                                </div>
                                                            )}
                                                            {item.product_detail_url && (
                                                                <a
                                                                    href={item.product_detail_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                                                                >
                                                                    <span>Daraz Page</span>
                                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="font-mono text-[10px] text-slate-500 dark:text-zinc-400 truncate max-w-[140px]" title={item.sku}>
                                                            {item.sku}
                                                        </span>
                                                        {item.matched_product_code ? (
                                                            <span className="font-mono text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                                                ID: {item.matched_product_code}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">-</span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="py-2.5 px-2.5 text-center font-bold text-slate-800 dark:text-zinc-200">
                                                    {item.qty}
                                                </td>

                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                                        {item.status}
                                                    </span>
                                                </td>

                                                <td className="py-2.5 px-3 text-right">
                                                    <div className="font-mono font-bold text-purple-700 dark:text-purple-400">
                                                        {item.purchase_price > 0 ? formatCurrency(item.purchase_price) : '-'}
                                                    </div>
                                                    {item.purchase_price_source && item.purchase_price > 0 && (
                                                        <span className="text-[9px] text-slate-400 dark:text-zinc-500 block">
                                                            {item.purchase_price_source}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                    {formatCurrency(item.item_price)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50/70 dark:bg-zinc-800/60 border-t border-slate-200 dark:border-zinc-700 font-semibold">
                                        <tr>
                                            <td colSpan={5} className="py-2 px-3 text-right text-[11px] uppercase tracking-wide text-slate-500">
                                                Order Subtotal:
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                {formatCurrency(order.price)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Financial Breakdown (Daraz Settlement Ledger) */}
                        {isFinanceVisible && (
                            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                                <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Receipt className="w-4 h-4 text-slate-500" />
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                                            Financial Breakdown (Daraz Ledger)
                                        </h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasFinance ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Live API Synced
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                                                <AlertCircle className="w-3 h-3" />
                                                Estimated Fees
                                            </span>
                                        )}
                                        {loadingFinance && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />}
                                    </div>
                                </div>

                                <div className="p-4 space-y-3">
                                    {/* SECTION 1: CREDITS / REVENUE */}
                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 pb-1 border-b border-slate-100 dark:border-zinc-800">
                                            Credits & Payout Additions
                                        </div>

                                        {/* Product Price Paid by Buyer - HIGHLIGHTED AND VERIFIED */}
                                        <div className="flex justify-between items-center py-1.5 px-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs">
                                            <div className="flex items-center gap-2">
                                                <ShoppingBag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                                    Product Price (Paid by Buyer)
                                                </span>
                                            </div>
                                            <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">
                                                {formatCurrency(val_price)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Shipping Fee (Paid by Buyer)</span>
                                            <span className="font-mono">{formatCurrency(val_shipping_buyer)}</span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span className="flex items-center gap-1.5">
                                                <span>Shipping Fee Discount (Platform/Seller Subsidy)</span>
                                            </span>
                                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                +{formatCurrency(val_shipping_discount)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* SECTION 2: DEDUCTIONS / FEES */}
                                    <div className="space-y-1.5 pt-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 pb-1 border-b border-slate-100 dark:border-zinc-800">
                                            Daraz Deductions & Fees
                                        </div>

                                        {/* Delivery Failed Alert if applicable */}
                                        {val_shipping_delivery_failed > 0 && (
                                            <div className="flex justify-between items-center py-2 px-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs">
                                                <div className="flex items-center gap-2">
                                                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                                                    <div>
                                                        <div className="font-bold text-rose-800 dark:text-rose-300">
                                                            Shipping Fee (Delivery Failed / Re-attempt)
                                                        </div>
                                                        <div className="text-[10px] text-rose-600 dark:text-rose-400">
                                                            Delivered Orders Marked Delivery Failed
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                                                    -{formatCurrency(val_shipping_delivery_failed)}
                                                </span>
                                            </div>
                                        )}

                                        {/* Unexpected / Custom Daraz Fees if applicable */}
                                        {unexpectedFeeTransactions.map((tx: any, idx: number) => {
                                            const txAmt = parseAmount(tx.amount)
                                            return (
                                                <div key={idx} className="flex justify-between items-center py-1.5 px-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                                        <div>
                                                            <span className="font-semibold text-amber-900 dark:text-amber-200">
                                                                {tx.fee_name || 'Extra Daraz Fee'}
                                                            </span>
                                                            {tx.transaction_type && (
                                                                <span className="text-[10px] text-amber-700/80 dark:text-amber-400 block">
                                                                    Type: {tx.transaction_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`font-mono font-bold ${txAmt < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                        {txAmt < 0 ? '-' : '+'}{formatCurrency(Math.abs(txAmt))}
                                                    </span>
                                                </div>
                                            )
                                        })}

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Commission Fee ({pct_commission}%)</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_commission)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Payment Processing Fee</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_payment)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Handling Fee</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_handling)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Free Shipping Max Fee</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_free_ship)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Co-funded Voucher Max</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_voucher)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Daraz Coins Discount Fee</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_coin)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>General Sales Tax / WHT</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                -{formatCurrency(val_tax)}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center py-1 px-2.5 text-xs text-slate-600 dark:text-zinc-400">
                                            <span>Shipping Fee (Original / Dex Delivery)</span>
                                            <span className="font-mono text-rose-600 dark:text-rose-400">
                                                {val_shipping_original > 0 ? `-${formatCurrency(val_shipping_original)}` : '0.00'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* SECTION 3: GRAND TOTAL (SETTLEMENT NET) */}
                                    <div className="pt-2">
                                        <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-slate-900 text-white dark:bg-zinc-800 dark:text-white shadow-xs">
                                            <div>
                                                <div className="text-xs font-bold uppercase tracking-wider">
                                                    Grand Total (Daraz Payout)
                                                </div>
                                                <div className="text-[10px] text-slate-400 dark:text-zinc-400">
                                                    Exact Net Receivable into bank statement
                                                </div>
                                            </div>
                                            <div className="font-mono font-bold text-base text-emerald-400">
                                                {formatCurrency(grand_total)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fee Analysis Comparison */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-4 shadow-2xs">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 mb-3 flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-slate-500" />
                                Fee Ratio & Margins
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                                    <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                                        Commission Fee
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-base font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(val_commission)}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500">
                                            ({pct_commission}%)
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                                    <div className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase">
                                        Total Deductions Ratio
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                                            {formatCurrency(val_total_fee)}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500">
                                            ({pct_combined}%)
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Net Profit & Order Metadata) - 5 cols */}
                    <div className="lg:col-span-5 space-y-4">

                        {/* Net Profit Calculation Card */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                                        Net Profit & Loss
                                    </h2>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    val_net_profit >= 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                                }`}>
                                    {val_net_profit >= 0 ? 'Profitable' : 'Loss'}
                                </span>
                            </div>

                            <div className="p-4 space-y-3">
                                {!isDelivered ? (
                                    <div className="text-center py-6 text-slate-500 text-xs">
                                        Profit calculation becomes active once an order is marked as delivered.
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 text-xs">
                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800">
                                                <span className="text-slate-600 dark:text-zinc-400 font-medium">
                                                    (+) Daraz Settlement (Receivable)
                                                </span>
                                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                    {formatCurrency(val_receivable)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-600 dark:text-zinc-400 font-medium">
                                                        (-) Total Daraz Deductions
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Already factored into settlement
                                                    </span>
                                                </div>
                                                <span className="font-mono text-rose-600 dark:text-rose-400">
                                                    -{formatCurrency(val_total_fee)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-600 dark:text-zinc-400 font-medium">
                                                        (-) Packaging & Operational Fee
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        Standard overhead
                                                    </span>
                                                </div>
                                                <span className="font-mono text-rose-600 dark:text-rose-400">
                                                    -{formatCurrency(val_other_fee_fixed)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-zinc-800">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-600 dark:text-zinc-400 font-medium">
                                                        (-) Product Purchase Cost
                                                    </span>
                                                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                                                        {displayItems[0]?.purchase_price_source || 'Inventory price'}
                                                    </span>
                                                </div>
                                                <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                                                    -{formatCurrency(val_total_purchase_cost)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Highlighted Net Profit Box */}
                                        <div className={`p-4 rounded-xl border mt-3 ${
                                            val_net_profit >= 0
                                                ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                                                : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                                        }`}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                                                        Net Profit (Take Home)
                                                    </span>
                                                    <div className={`text-xl font-black font-mono mt-0.5 ${
                                                        val_net_profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
                                                    }`}>
                                                        {val_net_profit >= 0 ? '+' : ''}{formatCurrency(val_net_profit)}
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                                        Profit Margin
                                                    </span>
                                                    <div className={`text-base font-bold ${
                                                        val_net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                                    }`}>
                                                        {val_profit_percent.toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>

                                            {val_roi > 0 && (
                                                <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-zinc-700/60 flex justify-between text-[11px] text-slate-600 dark:text-zinc-400 font-medium">
                                                    <span>Return on Investment (ROI):</span>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                        {val_roi.toFixed(2)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {val_total_purchase_cost === 0 && (
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-medium">
                                                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>
                                                    Purchase cost is not linked for this item. Map product in Inventory to track accurate margins.
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Order & Shipping Information */}
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-slate-500" />
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                                        Shipping & Logistics
                                    </h2>
                                </div>
                            </div>

                            <div className="p-4 space-y-3 text-xs">
                                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
                                    <span className="text-slate-500">Seller Store</span>
                                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{sellerAccount}</span>
                                </div>

                                {(order.tracking_code || order.tracking_number) && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-500">Tracking Code</span>
                                        <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                            {order.tracking_code || order.tracking_number}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
                                    <span className="text-slate-500">Courier Provider</span>
                                    <span className="font-medium text-slate-700 dark:text-zinc-300">
                                        {order.courier_provider || order.shipping_provider_type || 'NP-DEX (Daraz Express)'}
                                    </span>
                                </div>

                                {(order.shipping_city || order.shipping_address) && (
                                    <div className="flex justify-between items-start py-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-500">Destination</span>
                                        <span className="font-medium text-right text-slate-800 dark:text-zinc-200 max-w-[200px]">
                                            {[order.shipping_city, order.shipping_address].filter(Boolean).join(', ')}
                                        </span>
                                    </div>
                                )}

                                {placedDate && (
                                    <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
                                        <span className="text-slate-500">Placed Date</span>
                                        <span className="font-medium text-slate-700 dark:text-zinc-300">
                                            {new Date(placedDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    </div>
                                )}

                                {deliveredDate && (
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-500">Delivered Date</span>
                                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                            {new Date(deliveredDate).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}
