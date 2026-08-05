import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    console.log('Querying daraz_orders with status Delivered and non-null daraz_fees...')
    
    const { data: orders, error } = await supabase
        .from('daraz_orders')
        .select('id, order_number, order_status, daraz_fees, created_at, items:daraz_order_items(product_id, seller_sku, amount, quantity)')
        .eq('order_status', 'Delivered')
        .not('daraz_fees', 'is', null)
        .limit(20)

    if (error) {
        console.error('Error fetching orders:', error)
        return
    }

    console.log('Delivered orders count found:', orders?.length)
    if (orders && orders.length > 0) {
        console.log('Sample Delivered order:', JSON.stringify(orders[0], null, 2))
        
        // Let's count how many have non-zero fees
        const withFees = orders.filter(o => Math.abs(o.daraz_fees || 0) > 0)
        console.log('Orders with non-zero fees:', withFees.length)
        if (withFees.length > 0) {
            console.log('Sample order with non-zero fees:', JSON.stringify(withFees[0], null, 2))
        }
    }

    // Let's check how many total delivered orders are there
    const { count: totalDelivered, error: errDel } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')

    console.log('Total Delivered orders in DB:', totalDelivered)

    // Let's check how many total delivered orders have non-null daraz_fees
    const { count: totalDeliveredWithFees, error: errDelFees } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')
        .not('daraz_fees', 'is', null)

    console.log('Total Delivered orders with non-null fees in DB:', totalDeliveredWithFees)

    // Let's inspect daraz_orders schema or some random orders to see if there is another table or column for fees
    const { data: randomOrders } = await supabase
        .from('daraz_orders')
        .select('*')
        .limit(3)
    console.log('Random orders columns:', Object.keys(randomOrders?.[0] || {}))
}

run()
