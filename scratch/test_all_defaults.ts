import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const productsToCheck = [
        { id: '9ec724a3-b0e2-460a-bb9c-9bbf6daf2f85', name: 'Electric EMS Neck' },
        { id: '18546752-1738847282470', name: 'Personal Weighing Scale' }, // Wait, let's look up by name or ID
        { id: 'e0989a56-d9f1-4413-9455-bc7654aa8f4e', name: 'Bluetooth Weighing Scale' }
    ]

    // Let's search products in DB first
    const { data: allProds } = await supabase
        .from('products')
        .select('id, product_name, seller_sku1')
        .or('product_name.ilike.%EMS%,product_name.ilike.%Personal Weighing%,product_name.ilike.%Bluetooth Weighing%')

    console.log('Found matching products in DB:', allProds)

    if (!allProds) return

    // Let's run a check on delivered orders for each of these products in the database
    for (const p of allProds) {
        console.log(`\n=================== Product: ${p.product_name} (${p.id}) ===================`)
        
        // Let's fetch the latest 5 delivered orders with fees for this product
        const { data: items } = await supabase
            .from('daraz_order_items')
            .select(`
                id,
                seller_sku,
                amount,
                quantity,
                daraz_orders!inner(
                    id,
                    order_number,
                    daraz_fees,
                    created_at
                )
            `)
            .eq('product_id', p.id)
            .eq('daraz_orders.order_status', 'Delivered')
            .not('daraz_orders.daraz_fees', 'is', null)
            .order('created_at', { ascending: false, foreignTable: 'daraz_orders' })
            .limit(10)

        console.log(`Found ${items?.length || 0} order items with fees.`)
        
        if (items) {
            items.forEach((item: any, idx) => {
                const order = item.daraz_orders
                const fees = order?.daraz_fees || 0
                const qty = item.quantity || 1
                const itemRev = (item.amount || 0) * qty
                
                // Let's check how many items are in this order to see if it's a single-item order
                console.log(`  Order #${idx + 1} (${order?.order_number}):`)
                console.log(`    Date: ${order?.created_at}`)
                console.log(`    Order Fees: ${fees}`)
                console.log(`    Item Revenue: ${itemRev} (Qty: ${qty})`)
                console.log(`    Fee % based on order-level fees: ${(fees / itemRev * 100).toFixed(2)}%`)
            })
        }
    }
}

run()
