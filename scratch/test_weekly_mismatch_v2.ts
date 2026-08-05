import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NON_SOLD_STATUSES = [
    'Returned Delivered',
    'returned delivered',
    'Customer Return Delivered',
    'customer return delivered',
    'Cancelled',
    'cancelled',
    'Cancel',
    'cancel',
    'unpaid',
    'Unpaid',
]

export interface ProductReportRow {
    product_name: string
    seller_sku: string
    seller_account: string
    sold_qty: number
    delivered_qty: number
    shipped_qty: number
    total_orders: number
    delivered_revenue: number
    delivered_profit: number | null
    delivered_qty_with_cost: number
    has_profit_data: boolean
    unit_profit: number | null
    projected_profit: number | null
}

async function getProductReportDataReplica(params: any) {
    const {
        sellerAccount,
        dateRange,
        fromDate,
        toDate,
        dateType = 'shipped',
        page = 1,
        limit = 50,
    } = params

    let resolvedFrom: string | null = null
    let resolvedTo: string | null = null

    if (dateRange && dateRange !== 'custom') {
        const days = parseInt(dateRange)
        const now = new Date()
        const from = new Date(now)
        from.setDate(from.getDate() - days)
        resolvedFrom = from.toISOString().split('T')[0]
        resolvedTo = now.toISOString().split('T')[0]
    } else if (fromDate) {
        resolvedFrom = fromDate
        resolvedTo = toDate || new Date().toISOString().split('T')[0]
    }

    let rawItems: any[] = []
    let fetchPage = 0
    const FETCH_SIZE = 1000
    let hasMore = true

    while (hasMore) {
        const from = fetchPage * FETCH_SIZE
        const to = from + FETCH_SIZE - 1

        let pageQuery = supabase
            .from('daraz_order_items')
            .select(`
                id,
                product_name,
                seller_sku,
                seller_account,
                quantity,
                amount,
                item_status,
                purchase_cost,
                order_id,
                daraz_orders!inner(
                    id,
                    order_number,
                    order_date,
                    order_status,
                    daraz_fees,
                    deleted,
                    shipped_at,
                    delivered_by_daraz,
                    delivered_at
                )
            `)
            .not('product_name', 'is', null)
            .range(from, to)

        if (sellerAccount && sellerAccount !== 'all' && sellerAccount !== 'All') {
            pageQuery = pageQuery.eq('seller_account', sellerAccount)
        }

        if (resolvedFrom && resolvedTo) {
            if (dateType === 'delivered') {
                pageQuery = pageQuery.or(
                    `and(delivered_by_daraz.gte.${resolvedFrom}T00:00:00.000Z,delivered_by_daraz.lte.${resolvedTo}T23:59:59.999Z),` +
                    `and(delivered_by_daraz.is.null,delivered_at.gte.${resolvedFrom}T00:00:00.000Z,delivered_at.lte.${resolvedTo}T23:59:59.999Z)`,
                    { foreignTable: 'daraz_orders' }
                )
            } else {
                pageQuery = pageQuery.or(
                    `and(shipped_at.gte.${resolvedFrom}T00:00:00.000Z,shipped_at.lte.${resolvedTo}T23:59:59.999Z),` +
                    `and(shipped_at.is.null,order_date.gte.${resolvedFrom},order_date.lte.${resolvedTo})`,
                    { foreignTable: 'daraz_orders' }
                )
            }
        }

        const { data, error } = await pageQuery
        if (error) {
            console.error('[getProductReportData] Page fetch error:', error)
            throw new Error(error.message)
        }

        if (!data || data.length === 0) {
            hasMore = false
        } else {
            rawItems = rawItems.concat(data)
            if (data.length < FETCH_SIZE) {
                hasMore = false
            } else {
                fetchPage++
            }
        }
    }

    const items: any[] = rawItems.filter((item: any) => !item.daraz_orders?.deleted)

    const deliveredOrderIds = Array.from(new Set(
        items
            .filter((item: any) => {
                const effectiveStatus = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
                return effectiveStatus === 'delivered'
            })
            .map((item: any) => item.daraz_orders?.id)
            .filter(Boolean)
    ))

    let allOrderItems: any[] = []
    if (deliveredOrderIds.length > 0) {
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < deliveredOrderIds.length; i += CHUNK_SIZE) {
            chunks.push(deliveredOrderIds.slice(i, i + CHUNK_SIZE))
        }
        const promises = chunks.map(async (chunk) => {
            const { data, error } = await supabase
                .from('daraz_order_items')
                .select('order_id, quantity, amount, purchase_cost, product_id, product_name, seller_sku')
                .in('order_id', chunk)
            if (error) {
                console.error('[getProductReportData] Error fetching order items chunk:', error)
                return []
            }
            return data || []
        })
        const results = await Promise.all(promises)
        allOrderItems = results.flat()
    }

    const allProductIds = Array.from(new Set([
        ...items.map((i: any) => i.product_id),
        ...allOrderItems.map((i: any) => i.product_id)
    ].filter(Boolean)))

    const priceMap: Record<string, { last_price: number, est_price: number }> = {}
    if (allProductIds.length > 0) {
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < allProductIds.length; i += CHUNK_SIZE) {
            chunks.push(allProductIds.slice(i, i + CHUNK_SIZE))
        }
        const promises = chunks.map(async (chunk) => {
            const { data, error } = await supabase
                .from('inventory_price_reports_view')
                .select('product_id, last_price, est_price')
                .in('product_id', chunk)
            if (error) {
                console.error('[getProductReportData] Error fetching fallback prices chunk:', error)
                return []
            }
            return data || []
        })
        const results = await Promise.all(promises)
        results.flat().forEach((row: any) => {
            priceMap[row.product_id] = {
                last_price: row.last_price || 0,
                est_price: row.est_price || 0,
            }
        })
    }

    type OrderTotals = {
        total_revenue: number
        total_purchase_cost: number
        items: any[]
    }
    const orderTotalsMap: Record<string, OrderTotals> = {}

    allOrderItems.forEach((item: any) => {
        const orderId = item.order_id
        if (!orderTotalsMap[orderId]) {
            orderTotalsMap[orderId] = {
                total_revenue: 0,
                total_purchase_cost: 0,
                items: []
            }
        }
        const entry = orderTotalsMap[orderId]
        const qty = item.quantity || 1
        const amount = item.amount || 0
        const unitCost = item.purchase_cost || (item.product_id ? (priceMap[item.product_id]?.last_price || priceMap[item.product_id]?.est_price || 0) : 0)

        entry.total_revenue += amount * qty
        entry.total_purchase_cost += unitCost * qty
        entry.items.push({
            ...item,
            resolved_purchase_cost: unitCost
        })
    })

    type ProductKey = string
    const productMap: Map<ProductKey, {
        product_name: string
        seller_sku: string
        seller_account: string
        sold_qty: number
        delivered_qty: number
        shipped_qty: number
        total_orders: Set<string>
        delivered_revenue: number
        delivered_profit: number
        delivered_qty_with_cost: number
        has_profit_data: boolean
    }> = new Map()

    for (const item of items) {
        const pName = (item.product_name || 'Unknown').trim()
        const sSku = (item.seller_sku || '').trim()
        const sAccount = (item.seller_account || 'Unknown').trim()
        const key: ProductKey = `${pName}||${sAccount}`

        if (!productMap.has(key)) {
            productMap.set(key, {
                product_name: pName,
                seller_sku: sSku,
                seller_account: sAccount,
                sold_qty: 0,
                delivered_qty: 0,
                shipped_qty: 0,
                total_orders: new Set(),
                delivered_revenue: 0,
                delivered_profit: 0,
                delivered_qty_with_cost: 0,
                has_profit_data: false,
            })
        }

        const entry = productMap.get(key)!
        const effectiveStatus = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
        const qty = item.quantity || 1
        const orderId = item.daraz_orders?.id

        if (orderId) entry.total_orders.add(orderId)

        const isNonSold = NON_SOLD_STATUSES.some(s =>
            s.toLowerCase() === effectiveStatus.toLowerCase()
        )
        if (!isNonSold) {
            entry.sold_qty += qty
        }

        const orderStatus = (item.daraz_orders?.order_status || '').trim().toLowerCase()
        if (orderStatus === 'delivered') {
            entry.delivered_qty += qty
            entry.delivered_revenue += (item.amount || 0) * qty
        }

        if (effectiveStatus === 'shipped') {
            entry.shipped_qty += qty
        }
    }

    for (const item of items) {
        const orderStatus = (item.daraz_orders?.order_status || '').trim().toLowerCase()
        if (orderStatus !== 'delivered') continue

        const orderId = item.daraz_orders?.id
        if (!orderId) continue

        const totals = orderTotalsMap[orderId]
        if (!totals) continue

        const pName = (item.product_name || 'Unknown').trim()
        const sSku = (item.seller_sku || '').trim()
        const sAccount = (item.seller_account || 'Unknown').trim()
        const key: ProductKey = `${pName}||${sAccount}`
        const entry = productMap.get(key)
        if (!entry) continue

        const qty = item.quantity || 1
        const productRevenue = (item.amount || 0) * qty
        const orderTotalRev = totals.total_revenue || 1
        const darazFees = item.daraz_orders?.daraz_fees || 0

        const matchedOrderItem = totals.items.find((oi: any) =>
            (oi.seller_sku || '').trim().toLowerCase() === sSku.toLowerCase()
        )

        const purchaseCostPerUnit = matchedOrderItem ? matchedOrderItem.resolved_purchase_cost : 0
        const productCost = purchaseCostPerUnit * qty

        const revenueShare = orderTotalRev > 0 ? productRevenue / orderTotalRev : 0
        const feeShare = (darazFees + 30) * revenueShare

        const productProfit = productRevenue - productCost - feeShare

        if (purchaseCostPerUnit > 0) {
            entry.delivered_profit += productProfit
            entry.delivered_qty_with_cost += qty
            entry.has_profit_data = true
        }
    }

    const allRows: ProductReportRow[] = Array.from(productMap.values())
        .filter(e => e.total_orders.size > 0)
        .map(e => {
            const unitProfit = e.has_profit_data && e.delivered_qty_with_cost > 0
                ? e.delivered_profit / e.delivered_qty_with_cost
                : null

            const projectedProfit = unitProfit !== null && e.shipped_qty > 0
                ? unitProfit * e.shipped_qty
                : null

            return {
                product_name: e.product_name,
                seller_sku: e.seller_sku,
                seller_account: e.seller_account,
                sold_qty: e.sold_qty,
                delivered_qty: e.delivered_qty,
                shipped_qty: e.shipped_qty,
                total_orders: e.total_orders.size,
                delivered_revenue: e.delivered_revenue,
                delivered_profit: e.has_profit_data ? e.delivered_profit : null,
                delivered_qty_with_cost: e.delivered_qty_with_cost,
                has_profit_data: e.has_profit_data,
                unit_profit: unitProfit,
                projected_profit: projectedProfit,
            }
        })
        .sort((a, b) => b.sold_qty - a.sold_qty)

    const overallSummary = {
        total_sold_qty: allRows.reduce((s, r) => s + r.sold_qty, 0),
        total_delivered_qty: allRows.reduce((s, r) => s + r.delivered_qty, 0),
        total_shipped_qty: allRows.reduce((s, r) => s + r.shipped_qty, 0),
        total_delivered_revenue: allRows.reduce((s, r) => s + r.delivered_revenue, 0),
        total_delivered_profit: allRows.reduce((s, r) => s + (r.delivered_profit || 0), 0),
        total_projected_profit: allRows.reduce((s, r) => s + (r.projected_profit || 0), 0),
        has_profit_rows: allRows.some(r => r.has_profit_data),
        has_projected_rows: allRows.some(r => r.projected_profit !== null),
    }

    const total = allRows.length
    const from = (page - 1) * limit
    const paginatedRows = allRows.slice(from, from + limit)

    return {
        rows: paginatedRows,
        summary: overallSummary,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}

async function run() {
    const startDate = '2026-05-04'
    const endDate = '2026-05-10'

    console.log(`Running replicate server action for range ${startDate} to ${endDate}...`)

    const reportParams = {
        sellerAccount: 'All',
        dateRange: 'custom' as const,
        fromDate: startDate,
        toDate: endDate,
        dateType: 'delivered' as const,
        page: 1,
        limit: 50
    }

    try {
        const result = await getProductReportDataReplica(reportParams)
        console.log('\n--- Replica Server Action Result ---')
        console.log(`Pagination Total Rows: ${result.pagination.total}`)
        console.log(`Pagination Total Pages: ${result.pagination.totalPages}`)
        console.log(`Returned rows count: ${result.rows.length}`)
        console.log('Summary statistics:')
        console.log(JSON.stringify(result.summary, null, 2))

        // Let's sum up the page rows revenue
        const pageRevenue = result.rows.reduce((s, r) => s + r.delivered_revenue, 0)
        const pageProfit = result.rows.reduce((s, r) => s + (r.delivered_profit || 0), 0)
        console.log(`\nPage 1 Revenue (first 50 products): Rs. ${pageRevenue}`)
        console.log(`Page 1 Profit (first 50 products): Rs. ${pageProfit}`)
    } catch (e: any) {
        console.error('Error running replica:', e)
    }
}

run()
