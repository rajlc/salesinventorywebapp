import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const startDate = '2026-05-04'
    const endDate = '2026-05-10'

    console.log(`Running order-by-order profit comparison for range ${startDate} to ${endDate}...`)

    // 1. Fetch from database directly
    // Get all orders matching delivered filter
    const { data: rawItems, error } = await supabase
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
        .or(
            `and(delivered_by_daraz.gte.${startDate}T00:00:00.000Z,delivered_by_daraz.lte.${endDate}T23:59:59.999Z),` +
            `and(delivered_by_daraz.is.null,delivered_at.gte.${startDate}T00:00:00.000Z,delivered_at.lte.${endDate}T23:59:59.999Z)`,
            { foreignTable: 'daraz_orders' }
        )

    if (error) {
        console.error('Error fetching items:', error)
        return
    }

    const items = (rawItems || []).filter((item: any) => !item.daraz_orders?.deleted && item.daraz_orders?.order_status?.toLowerCase() === 'delivered')
    console.log(`Total delivered items matching date range: ${items.length}`)

    // Fetch fallback prices
    const allProductIds = Array.from(new Set(items.map((i: any) => i.product_id).filter(Boolean)))
    const priceMap: Record<string, number> = {}
    if (allProductIds.length > 0) {
        const { data: prices } = await supabase
            .from('inventory_price_reports_view')
            .select('product_id, last_price, est_price')
            .in('product_id', allProductIds)
        
        prices?.forEach((row: any) => {
            priceMap[row.product_id] = row.last_price || row.est_price || 0
        })
    }

    // Group items by order
    const orderItemsMap: Record<string, any[]> = {}
    items.forEach((item: any) => {
        const orderNum = item.daraz_orders.order_number
        if (!orderItemsMap[orderNum]) {
            orderItemsMap[orderNum] = []
        }
        orderItemsMap[orderNum].push(item)
    })

    console.log(`Total unique delivered orders: ${Object.keys(orderItemsMap).length}`)

    // Compare order by order
    let rpcTotalProfit = 0
    let reportTotalProfit = 0
    let reportTotalProfitIgnoringCostCheck = 0
    
    let ordersWithMismatchCount = 0
    const mismatchDetails: any[] = []

    for (const [orderNum, orderItems] of Object.entries(orderItemsMap)) {
        const o = orderItems[0].daraz_orders
        const darazFees = o.daraz_fees || 0
        
        // 1. Calculate order total revenue and costs
        let orderTotalRevenue = 0
        let orderTotalCost = 0
        
        orderItems.forEach((item: any) => {
            const qty = item.quantity || 1
            const amount = item.amount || 0
            const resolvedCost = item.purchase_cost || priceMap[item.product_id] || 0
            orderTotalRevenue += amount * qty
            orderTotalCost += resolvedCost * qty
        })

        // RPC profit calculation
        const rpcOrderProfit = orderTotalRevenue - orderTotalCost - darazFees - 30
        rpcTotalProfit += rpcOrderProfit

        // Product Report profit calculation
        let reportOrderProfit = 0
        let reportOrderProfitIgnoringCostCheck = 0
        let hasMissingCost = false

        orderItems.forEach((item: any) => {
            const qty = item.quantity || 1
            const productRevenue = (item.amount || 0) * qty
            const resolvedCost = item.purchase_cost || priceMap[item.product_id] || 0
            const productCost = resolvedCost * qty

            const revenueShare = orderTotalRevenue > 0 ? productRevenue / orderTotalRevenue : 0
            const feeShare = (darazFees + 30) * revenueShare
            const productProfit = productRevenue - productCost - feeShare

            reportOrderProfitIgnoringCostCheck += productProfit

            if (resolvedCost > 0) {
                reportOrderProfit += productProfit
            } else {
                hasMissingCost = true
            }
        })

        reportTotalProfit += reportOrderProfit
        reportTotalProfitIgnoringCostCheck += reportOrderProfitIgnoringCostCheck

        const diff = Math.abs(rpcOrderProfit - reportOrderProfit)
        if (diff > 0.01) {
            ordersWithMismatchCount++
            if (mismatchDetails.length < 10) {
                mismatchDetails.push({
                    orderNum,
                    rpcOrderProfit,
                    reportOrderProfit,
                    reportOrderProfitIgnoringCostCheck,
                    hasMissingCost,
                    totalRev: orderTotalRevenue,
                    totalCost: orderTotalCost,
                    darazFees,
                    items: orderItems.map(item => ({
                        name: item.product_name,
                        qty: item.quantity,
                        amount: item.amount,
                        cost: item.purchase_cost || priceMap[item.product_id] || 0
                    }))
                })
            }
        }
    }

    console.log('\n--- Comparative Totals ---')
    console.log(`RPC Sum of Profits: Rs. ${rpcTotalProfit}`)
    console.log(`Product Report Sum of Profits (synced items only): Rs. ${reportTotalProfit}`)
    console.log(`Product Report Sum of Profits (ignoring cost check): Rs. ${reportTotalProfitIgnoringCostCheck}`)
    console.log(`Difference (RPC - Report Synced): Rs. ${rpcTotalProfit - reportTotalProfit}`)
    console.log(`Difference (RPC - Report All): Rs. ${rpcTotalProfit - reportTotalProfitIgnoringCostCheck}`)
    console.log(`Total orders with mismatch: ${ordersWithMismatchCount}`)

    console.log('\n--- Sample Mismatch Details ---')
    console.log(JSON.stringify(mismatchDetails, null, 2))
}

run()
