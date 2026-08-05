import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    console.log('Fetching order items for commission analysis...')
    
    // We fetch a larger batch of order items (e.g. 5000 rows)
    let rawItems: any[] = []
    let page = 0
    const PAGE_SIZE = 1000
    const MAX_PAGES = 5 // Fetch up to 5000 items

    while (page < MAX_PAGES) {
        const from = page * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        
        const { data, error } = await supabase
            .from('daraz_order_items')
            .select(`
                product_id,
                seller_sku,
                amount,
                quantity,
                daraz_orders!inner(
                    id,
                    order_number,
                    daraz_fees,
                    order_status,
                    deleted
                )
            `)
            .eq('daraz_orders.order_status', 'Delivered')
            .eq('daraz_orders.deleted', false)
            .not('daraz_orders.daraz_fees', 'is', null)
            .range(from, to)

        if (error) {
            console.error('Fetch error:', error)
            break
        }
        if (!data || data.length === 0) break
        
        rawItems = rawItems.concat(data)
        if (data.length < PAGE_SIZE) break
        page++
    }

    console.log(`Fetched ${rawItems.length} order items.`)

    // Now let's calculate the total revenue for each order so we know which orders are single-item
    const orderRevenueMap = new Map<string, number>()
    const orderItemCountMap = new Map<string, number>()

    rawItems.forEach(item => {
        const orderId = item.daraz_orders.id
        const itemRevenue = (item.amount || 0) * (item.quantity || 1)
        
        orderRevenueMap.set(orderId, (orderRevenueMap.get(orderId) || 0) + itemRevenue)
        orderItemCountMap.set(orderId, (orderItemCountMap.get(orderId) || 0) + 1)
    })

    // Now let's calculate commission for each product
    // We group by product_id
    // For each product, we collect:
    // - single-item order commission rates
    // - multi-item order commission rates (overall order-level rates as a fallback)
    const productCommissionMap = new Map<string, { singleItemRates: number[], multiItemRates: number[] }>()

    rawItems.forEach(item => {
        const pid = item.product_id
        if (!pid) return

        const orderId = item.daraz_orders.id
        const orderFees = Math.abs(item.daraz_orders.daraz_fees || 0)
        const orderRevenue = orderRevenueMap.get(orderId) || 0
        const orderItemCount = orderItemCountMap.get(orderId) || 1

        if (orderRevenue <= 0 || orderFees <= 0) return

        const rate = orderFees / orderRevenue
        // Cap rates between 2% and 50% for sanity
        if (rate < 0.02 || rate > 0.50) return

        if (!productCommissionMap.has(pid)) {
            productCommissionMap.set(pid, { singleItemRates: [], multiItemRates: [] })
        }

        const entry = productCommissionMap.get(pid)!
        if (orderItemCount === 1) {
            entry.singleItemRates.push(rate)
        } else {
            entry.multiItemRates.push(rate)
        }
    })

    // Let's check results for our target products
    const targets = [
        { id: '9ec724a3-b0e2-460a-bb9c-9bbf6daf2f85', name: 'Electric EMS Massager' },
        { id: 'd0406a87-4c13-4da4-a09b-7590b0ed3c72', name: 'Personal Weighing Scale' },
        { id: 'e0989a56-d9f1-4413-9455-bc7654aa8f4e', name: 'Bluetooth Weighing Scale' }
    ]

    targets.forEach(t => {
        console.log(`\nResults for ${t.name} (${t.id}):`)
        const entry = productCommissionMap.get(t.id)
        if (!entry) {
            console.log('  No commission data found!')
            return
        }

        console.log(`  Single-item orders count: ${entry.singleItemRates.length}`)
        if (entry.singleItemRates.length > 0) {
            const avgSingle = entry.singleItemRates.reduce((a, b) => a + b, 0) / entry.singleItemRates.length
            console.log(`  Average Single-item rate: ${(avgSingle * 100).toFixed(2)}%`)
            console.log(`  Rates:`, entry.singleItemRates.slice(0, 5).map(r => (r * 100).toFixed(2) + '%'))
        }

        console.log(`  Multi-item orders count: ${entry.multiItemRates.length}`)
        if (entry.multiItemRates.length > 0) {
            const avgMulti = entry.multiItemRates.reduce((a, b) => a + b, 0) / entry.multiItemRates.length
            console.log(`  Average Multi-item rate: ${(avgMulti * 100).toFixed(2)}%`)
        }
    })
}

run()
