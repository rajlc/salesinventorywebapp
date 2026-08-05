import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    const extraOrders = [
        '215448971944005',
        '215456581455499',
        '215310277961612',
        '215326601320282'
    ]

    console.log('Querying details for the 4 extra orders...')

    const { data, error } = await supabase
        .from('daraz_orders')
        .select('order_number, order_status, delivered_by_daraz, delivered_at, deleted, items:daraz_order_items(product_name, quantity, amount, item_status)')
        .in('order_number', extraOrders)

    if (error) {
        console.error('Error:', error)
        return
    }

    data?.forEach(o => {
        console.log(`\nOrder Number: ${o.order_number}`)
        console.log(`Order Status: ${o.order_status}`)
        console.log(`Delivered by Daraz: ${o.delivered_by_daraz}`)
        console.log(`Delivered At: ${o.delivered_at}`)
        console.log(`Deleted: ${o.deleted}`)
        console.log('Items:')
        o.items?.forEach((item: any) => {
            console.log(`  - Name: ${item.product_name}, Qty: ${item.quantity}, Amt: ${item.amount}, Status: ${item.item_status}`)
        })
    })
}

run()
