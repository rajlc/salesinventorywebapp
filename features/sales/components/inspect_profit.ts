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
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 14)
    const resolvedFrom = from.toISOString().split('T')[0]
    const resolvedTo = now.toISOString().split('T')[0]

    console.log(`Filtering from ${resolvedFrom} to ${resolvedTo}`)

    let itemQuery = supabase
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
                deleted
            )
        `)
        .not('product_name', 'is', null)
        .gte('daraz_orders.order_date', resolvedFrom)
        .lte('daraz_orders.order_date', resolvedTo)

    const { data: rawItems, error: itemsError } = await itemQuery.limit(10000)

    if (itemsError) {
        console.error('Error fetching items:', itemsError)
        return
    }

    const items = (rawItems || []).filter((item: any) => !item.daraz_orders?.deleted)
    console.log('Total items fetched (non-deleted orders):', items.length)

    const deliveredItems = items.filter((item: any) => {
        const effectiveStatus = (item.item_status || item.daraz_orders?.order_status || '').trim().toLowerCase()
        return effectiveStatus === 'delivered'
    })
    console.log('Delivered items:', deliveredItems.length)

    const deliveredOrderIds = Array.from(new Set(deliveredItems.map((item: any) => item.daraz_orders?.id).filter(Boolean)))
    console.log('Delivered unique order IDs count:', deliveredOrderIds.length)

    if (deliveredOrderIds.length > 0) {
        // Chunking the UUID array to groups of 100
        const CHUNK_SIZE = 100
        const chunks: string[][] = []
        for (let i = 0; i < deliveredOrderIds.length; i += CHUNK_SIZE) {
            chunks.push(deliveredOrderIds.slice(i, i + CHUNK_SIZE))
        }

        console.log(`Split ${deliveredOrderIds.length} IDs into ${chunks.length} chunks of size ${CHUNK_SIZE}`)

        // Fetch each chunk in parallel
        const promises = chunks.map(async (chunk) => {
            const { data, error } = await supabase
                .from('daraz_order_report_view')
                .select('order_primary_id, total_revenue, total_purchase_cost, daraz_fees, estimated_profit, items_summary')
                .in('order_primary_id', chunk)
            
            if (error) {
                console.error('Error fetching chunk:', error)
                return []
            }
            return data || []
        })

        const results = await Promise.all(promises)
        const profitData = results.flat()

        console.log('Combined profit data rows returned:', profitData.length)
        
        if (profitData.length > 0) {
            console.log('Sample profitData row 0:')
            console.log(JSON.stringify(profitData[0], null, 2))
            
            let matchedCount = 0
            const profitMap: any = {}
            profitData.forEach((row: any) => {
                profitMap[row.order_primary_id] = row
            })

            deliveredItems.forEach((item: any) => {
                if (profitMap[item.daraz_orders?.id]) {
                    matchedCount++
                }
            })
            console.log(`Matched delivered items to profit tracker entries: ${matchedCount} out of ${deliveredItems.length}`)
        }
    }
}

run()
