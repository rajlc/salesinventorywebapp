import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testCommissionLogic() {
    // 1b. Fetch SKUs from products table (since view might not have them)
    const { data: skusData, error: skuError } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4, sales_priority, priority_seller_account')

    if (skuError) {
        console.error('Error fetching SKUs from products table:', skuError)
    }

    const skuMap = new Map<string, any>()
    const reverseSkuMap = new Map<string, string>() // Map SKU to Product ID

    if (skusData) {
        skusData.forEach(s => {
            skuMap.set(s.id, s)
            if (s.seller_sku1) reverseSkuMap.set(s.seller_sku1.toLowerCase().trim(), s.id)
            if (s.seller_sku2) reverseSkuMap.set(s.seller_sku2.toLowerCase().trim(), s.id)
            if (s.seller_sku3) reverseSkuMap.set(s.seller_sku3.toLowerCase().trim(), s.id)
            if (s.seller_sku4) reverseSkuMap.set(s.seller_sku4.toLowerCase().trim(), s.id)
        })
    }

    // 3. Fetch recent delivered order items to calculate accurate product commissions
    let rawOrderItems: any[] = []
    try {
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
                        daraz_fees,
                        order_status,
                        deleted
                    )
                `)
                .eq('daraz_orders.order_status', 'Delivered')
                .eq('daraz_orders.deleted', false)
                .not('daraz_orders.daraz_fees', 'is', null)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) {
                console.error(`[Page ${page}] Error fetching order items for commission:`, error)
                break
            }
            if (!data || data.length === 0) {
                console.log(`[Page ${page}] No data returned.`)
                break
            }
            
            console.log(`[Page ${page}] Fetched ${data.length} items.`)
            rawOrderItems = rawOrderItems.concat(data)
            if (data.length < PAGE_SIZE) break
            page++
        }
    } catch (err) {
        console.error('Exception fetching order items for commission:', err)
    }

    console.log(`Total rawOrderItems fetched: ${rawOrderItems.length}`)

    // Compile order total revenue and order items count
    const orderRevenueMap = new Map<string, number>()
    const orderItemCountMap = new Map<string, number>()

    rawOrderItems.forEach((item: any) => {
        const orderId = item.daraz_orders?.id
        if (!orderId) return
        const itemRevenue = (item.amount || 0) * (item.quantity || 1)
        
        orderRevenueMap.set(orderId, (orderRevenueMap.get(orderId) || 0) + itemRevenue)
        orderItemCountMap.set(orderId, (orderItemCountMap.get(orderId) || 0) + 1)
    })

    // Group rates by product
    const productCommissionDataMap = new Map<string, { singleItemRates: number[], multiItemRates: number[] }>()

    rawOrderItems.forEach((item: any) => {
        let pid = item.product_id
        if (!pid && item.seller_sku) {
            pid = reverseSkuMap.get(item.seller_sku.toLowerCase().trim())
        }
        if (!pid) return

        const orderId = item.daraz_orders?.id
        const orderFees = Math.abs(item.daraz_orders?.daraz_fees || 0)
        const orderRevenue = orderRevenueMap.get(orderId) || 0
        const orderItemCount = orderItemCountMap.get(orderId) || 1

        if (orderRevenue <= 0 || orderFees <= 0) return

        const rate = orderFees / orderRevenue
        // Filter out extreme outlier rates (cap between 2% and 55% for safety)
        if (rate < 0.02 || rate > 0.55) return

        if (!productCommissionDataMap.has(pid)) {
            productCommissionDataMap.set(pid, { singleItemRates: [], multiItemRates: [] })
        }

        const entry = productCommissionDataMap.get(pid)!
        if (orderItemCount === 1) {
            entry.singleItemRates.push(rate)
        } else {
            entry.multiItemRates.push(rate)
        }
    })

    // Let's inspect targets
    const targets = [
        { id: '9ec724a3-b0e2-460a-bb9c-9bbf6daf2f85', name: 'Electric EMS Massager' },
        { id: 'd0406a87-4c13-4da4-a09b-7590b0ed3c72', name: 'Personal Weighing Scale' },
        { id: 'e0989a56-d9f1-4413-9455-bc7654aa8f4e', name: 'Bluetooth Weighing Scale' }
    ]

    targets.forEach(t => {
        const commData = productCommissionDataMap.get(t.id)
        console.log(`\nTarget ${t.name} (${t.id}):`)
        if (!commData) {
            console.log('  -> Not found in productCommissionDataMap!')
        } else {
            console.log(`  -> found: singleItemRates count: ${commData.singleItemRates.length}, multiItemRates count: ${commData.multiItemRates.length}`)
            if (commData.singleItemRates.length > 0) {
                const sum = commData.singleItemRates.reduce((a, b) => a + b, 0)
                console.log(`  -> Average single-item rate: ${(sum / commData.singleItemRates.length * 100).toFixed(2)}%`)
            }
        }
    })
}

testCommissionLogic()
