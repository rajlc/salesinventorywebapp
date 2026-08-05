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
    const resolvedFrom = '2026-04-29'
    const resolvedTo = '2026-05-15'

    console.log(`Analyzing orders shipped/placed between ${resolvedFrom} and ${resolvedTo}...`)

    let itemQuery = supabase
        .from('daraz_order_items')
        .select(`
            order_id,
            daraz_orders!inner(
                id,
                order_number,
                order_date,
                order_status,
                deleted,
                shipped_at
            )
        `)
        .not('product_name', 'is', null)
        .or(
            `and(shipped_at.gte.${resolvedFrom}T00:00:00.000Z,shipped_at.lt.${resolvedTo}T00:00:00.000Z),` +
            `and(shipped_at.is.null,order_date.gte.${resolvedFrom},order_date.lt.${resolvedTo})`,
            { foreignTable: 'daraz_orders' }
        )

    const { data: rawItems } = await itemQuery.limit(10000)
    const items = (rawItems || []).filter((item: any) => !item.daraz_orders?.deleted && item.daraz_orders?.order_status === 'Delivered')
    const orderIds = Array.from(new Set(items.map((item: any) => item.daraz_orders?.id).filter(Boolean)))

    console.log(`Found ${orderIds.length} unique delivered orders in the 15-30 day window.`)

    if (orderIds.length > 0) {
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
            chunks.push(orderIds.slice(i, i + CHUNK_SIZE))
        }
        const promises = chunks.map(async (chunk) => {
            const { data } = await supabase
                .from('daraz_order_report_view')
                .select('order_number, total_revenue, total_purchase_cost, daraz_fees, estimated_profit, delivery_date')
                .in('order_primary_id', chunk)
            return data || []
        })
        const results = await Promise.all(promises)
        const profitData = results.flat()

        // Sort by profit ascending to see largest losses first
        profitData.sort((a, b) => a.estimated_profit - b.estimated_profit)

        console.log('Top 15 orders with largest losses/profits in the 15-30 day window:')
        profitData.slice(0, 15).forEach(row => {
            console.log(`Order: ${row.order_number}, Date: ${row.delivery_date}, Rev: ${row.total_revenue}, Cost: ${row.total_purchase_cost}, Fees: ${row.daraz_fees}, Profit: ${row.estimated_profit}`)
        })

        // Also let's print sum of profits for this window
        const sumProfit = profitData.reduce((acc, row) => acc + (row.estimated_profit || 0), 0)
        console.log('\nNet Profit in the 15-30 day window:', sumProfit)
    }
}

run()
