import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
    const targetDate = new Date('2026-05-29')
    
    const getRangeData = async (days: number) => {
        const cutoff = new Date(targetDate)
        cutoff.setDate(cutoff.getDate() - days)
        const cutoffStr = cutoff.toISOString().split('T')[0]

        console.log(`\n--- Cutoff ${days} days: ${cutoffStr} ---`)

        // 1. Fetch matching rawItems paginated
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
                    product_id,
                    order_id,
                    daraz_orders!inner(
                        id,
                        order_number,
                        order_date,
                        order_status,
                        daraz_fees,
                        deleted,
                        shipped_at
                    )
                `)
                .not('product_name', 'is', null)
                .range(from, to)
                .or(
                    `and(shipped_at.gte.${cutoffStr}T00:00:00.000Z,shipped_at.lte.2026-05-29T23:59:59.999Z),` +
                    `and(shipped_at.is.null,order_date.gte.${cutoffStr},order_date.lte.2026-05-29)`,
                    { foreignTable: 'daraz_orders' }
                )

            const { data, error } = await pageQuery
            if (error) {
                console.error('Error fetching page:', error)
                return
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

        const items = rawItems.filter((item: any) => !item.daraz_orders?.deleted)
        console.log('Total items matching date filter:', items.length)

        const deliveredItems = items.filter((item: any) => {
            const status = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
            return status === 'delivered'
        })
        console.log('Delivered items:', deliveredItems.length)

        const deliveredOrderIds = Array.from(new Set(deliveredItems.map((item: any) => item.daraz_orders?.id).filter(Boolean)))
        console.log('Delivered unique order count:', deliveredOrderIds.length)

        // 2. Fetch all items for these delivered orders (to calculate orderTotalRev)
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
                    .select('order_id, quantity, amount, purchase_cost, product_id, product_name')
                    .in('order_id', chunk)
                if (error) {
                    console.error('Error fetching chunk:', error)
                    return []
                }
                return data || []
            })
            const results = await Promise.all(promises)
            allOrderItems = results.flat()
        }

        // 3. Fetch fallback prices for all product_ids
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
                const { data } = await supabase
                    .from('inventory_price_reports_view')
                    .select('product_id, last_price, est_price')
                    .in('product_id', chunk)
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

        // 4. Calculate order totals
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

        // 5. Calculate profit
        let totalCalculatedProfit = 0
        deliveredItems.forEach((item: any) => {
            const orderId = item.daraz_orders?.id
            const totals = orderTotalsMap[orderId]
            if (!totals) return

            const qty = item.quantity || 1
            const productRevenue = (item.amount || 0) * qty
            const orderTotalRev = totals.total_revenue || 1
            const darazFees = item.daraz_orders?.daraz_fees || 0

            const pName = (item.product_name || '').trim()
            const matchedOrderItem = totals.items.find((oi: any) =>
                (oi.product_name || '').trim().toLowerCase() === pName.toLowerCase()
            )
            const purchaseCostPerUnit = matchedOrderItem ? matchedOrderItem.resolved_purchase_cost : 0
            const productCost = purchaseCostPerUnit * qty

            const revenueShare = orderTotalRev > 0 ? productRevenue / orderTotalRev : 0
            const feeShare = (darazFees + 30) * revenueShare

            const productProfit = productRevenue - productCost - feeShare
            totalCalculatedProfit += productProfit
        })

        console.log('Total calculated profit (View-Independent):', totalCalculatedProfit)
    }

    await getRangeData(14)
    await getRangeData(30)
}

run()
