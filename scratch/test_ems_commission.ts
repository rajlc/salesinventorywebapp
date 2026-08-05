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
    console.log('Inspecting orders for EMS Massager (ID: 9ec724a3-b0e2-460a-bb9c-9bbf6daf2f85)...')

    // Get order items for this product
    const { data: items, error } = await supabase
        .from('daraz_order_items')
        .select(`
            id,
            seller_sku,
            amount,
            quantity,
            item_status,
            daraz_orders!inner(
                id,
                order_number,
                order_status,
                daraz_fees,
                deleted
            )
        `)
        .eq('product_id', emsId)
        .eq('daraz_orders.order_status', 'Delivered')
        .limit(20)

    if (error) {
        console.error('Error fetching EMS order items:', error)
        return
    }

    console.log('Delivered EMS order items count:', items?.length)
    if (items) {
        items.forEach((item: any, i) => {
            const order = item.daraz_orders
            const fees = order?.daraz_fees || 0
            const amount = item.amount || 0
            const qty = item.quantity || 1
            console.log(`\nItem ${i + 1}:`)
            console.log(`  SKU: ${item.seller_sku}`)
            console.log(`  Order Status: ${order?.order_status}, Deleted: ${order?.deleted}`)
            console.log(`  Order Fees: ${fees}`)
            console.log(`  Item Amount: ${amount}, Qty: ${qty}`)
        })
    }
}

run()
