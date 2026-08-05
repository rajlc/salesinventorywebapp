import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const emsId = '9ec724a3-b0e2-460a-bb9c-9bbf6daf2f85'
    
    // 1b. Fetch SKUs from products table
    const { data: skusData } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_account1, seller_sku2, seller_account2, seller_sku3, seller_account3, seller_sku4, seller_account4')

    const reverseSkuMap = new Map<string, string>()
    if (skusData) {
        skusData.forEach(s => {
            if (s.seller_sku1) reverseSkuMap.set(s.seller_sku1.toLowerCase().trim(), s.id)
            if (s.seller_sku2) reverseSkuMap.set(s.seller_sku2.toLowerCase().trim(), s.id)
            if (s.seller_sku3) reverseSkuMap.set(s.seller_sku3.toLowerCase().trim(), s.id)
            if (s.seller_sku4) reverseSkuMap.set(s.seller_sku4.toLowerCase().trim(), s.id)
        })
    }

    // 3. Fetch Delivered Daraz Orders with fees
    const { data: ordersWithItems, error: ordersError } = await supabase
        .from('daraz_orders')
        .select(`
            id,
            daraz_fees,
            created_at,
            order_date,
            items:daraz_order_items(product_id, seller_sku, amount, quantity)
        `)
        .eq('order_status', 'Delivered')
        .not('daraz_fees', 'is', null)
        .order('created_at', { ascending: false })

    console.log('Total delivered orders fetched:', ordersWithItems?.length)

    const latestCommissionMap = new Map<string, number>()
    const matchesForEms: any[] = []

    if (ordersWithItems) {
        ordersWithItems.forEach((order: any) => {
            const fees = Math.abs(order.daraz_fees || 0)
            if (fees > 0) {
                const totalRevenue = (order.items || []).reduce((sum: number, item: any) => sum + ((item.amount || 0) * (item.quantity || 1)), 0)

                if (totalRevenue > 0) {
                    const feePercent = fees / totalRevenue
                    if (feePercent >= 0 && feePercent < 1) {
                        const productIds = new Set<string>()
                        let hasEms = false
                        order.items?.forEach((item: any) => {
                            let pid = item.product_id
                            if (!pid && item.seller_sku) {
                                pid = reverseSkuMap.get(item.seller_sku.toLowerCase().trim())
                            }
                            if (pid) {
                                productIds.add(pid)
                                if (pid === emsId) {
                                    hasEms = true
                                }
                            }
                        })

                        if (hasEms) {
                            matchesForEms.push({
                                orderId: order.id,
                                fees,
                                totalRevenue,
                                feePercent,
                                productIds: Array.from(productIds)
                            })
                        }

                        productIds.forEach(pid => {
                            if (!latestCommissionMap.has(pid)) {
                                latestCommissionMap.set(pid, feePercent)
                            }
                        })
                    }
                }
            }
        })
    }

    console.log('Matches found where order contains EMS Massager:', matchesForEms.length)
    if (matchesForEms.length > 0) {
        console.log('Sample matched order for EMS:', JSON.stringify(matchesForEms[0], null, 2))
    }
    console.log('EMS in latestCommissionMap:', latestCommissionMap.get(emsId))
}

run()
