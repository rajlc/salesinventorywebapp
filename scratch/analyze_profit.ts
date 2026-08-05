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

        console.log(`\n--- Fetching orders for ${days} days cutoff (${cutoffStr}) ---`)

        // 1. Get ALL items (we'll filter dates in JS using shipped_at / order_date)
        const { data: rawItems } = await supabase
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
                    shipped_at
                )
            `)
            .not('product_name', 'is', null)

        const items = (rawItems || []).filter((item: any) => {
            if (item.daraz_orders?.deleted) return false
            
            // Determine effective date: shipped_at (if present) else order_date
            const shippedAt = item.daraz_orders?.shipped_at
            const effectiveDate = shippedAt ? shippedAt.split('T')[0] : item.daraz_orders?.order_date
            
            return effectiveDate >= cutoffStr && effectiveDate <= '2026-05-29'
        })

        const deliveredItems = items.filter((item: any) => {
            const status = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
            return status === 'delivered'
        })

        const deliveredOrderIds = Array.from(new Set(deliveredItems.map((item: any) => item.daraz_orders?.id).filter(Boolean)))

        // Fetch profit tracker data
        let profitData: any[] = []
        if (deliveredOrderIds.length > 0) {
            const CHUNK_SIZE = 100
            const chunks: string[][] = []
            for (let i = 0; i < deliveredOrderIds.length; i += CHUNK_SIZE) {
                chunks.push(deliveredOrderIds.slice(i, i + CHUNK_SIZE))
            }
            const promises = chunks.map(async (chunk) => {
                const { data } = await supabase
                    .from('daraz_order_report_view')
                    .select('order_primary_id, total_revenue, total_purchase_cost, daraz_fees, estimated_profit, items_summary')
                    .in('order_primary_id', chunk)
                return data || []
            })
            const results = await Promise.all(promises)
            profitData = results.flat()
        }

        const profitMap: any = {}
        profitData.forEach((row: any) => {
            profitMap[row.order_primary_id] = row
        })

        // Let's compute profit
        let totalEstimatedProfitFromTracker = 0
        let sumProductProfit = 0

        deliveredOrderIds.forEach(orderId => {
            const pd = profitMap[orderId]
            if (pd) {
                totalEstimatedProfitFromTracker += (pd.estimated_profit || 0)
            }
        })

        deliveredItems.forEach((item: any) => {
            const orderId = item.daraz_orders?.id
            const pd = profitMap[orderId]
            if (!pd) return

            const qty = item.quantity || 1
            const productRevenue = (item.amount || 0) * qty
            const orderTotalRev = pd.total_revenue || 1

            const pName = (item.product_name || '').trim()
            const summaryItem = pd.items_summary?.find((si: any) => 
                (si.product_name || '').trim().toLowerCase() === pName.toLowerCase()
            )
            const purchaseCostPerUnit = summaryItem ? (summaryItem.purchase_cost || 0) : (item.purchase_cost || 0)
            const productCost = purchaseCostPerUnit * qty

            const revenueShare = orderTotalRev > 0 ? productRevenue / orderTotalRev : 0
            const feeShare = (pd.daraz_fees + 30) * revenueShare

            const productProfit = productRevenue - productCost - feeShare
            sumProductProfit += productProfit
        })

        console.log('Delivered Orders Count:', deliveredOrderIds.length)
        console.log('Total Estimated Profit (from Profit Tracker):', totalEstimatedProfitFromTracker)
        console.log('Sum of Product-Level calculated profits:', sumProductProfit)
    }

    await getRangeData(14)
    await getRangeData(30)
}

run()
