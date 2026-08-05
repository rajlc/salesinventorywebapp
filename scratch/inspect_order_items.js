const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: orders, error: err } = await supabase
        .from('daraz_orders')
        .select('order_id, customer_name, customer_first_name, customer_last_name, items_detail')
        .limit(3)

    if (err) {
        console.error('Error fetching orders:', err)
        return
    }

    console.log('\n--- Sample Daraz Orders ---')
    orders.forEach(o => {
        console.log(`Order ID: ${o.order_id}`)
        console.log(`Customer Name: ${o.customer_name}`)
        console.log(`Customer First/Last: ${o.customer_first_name} ${o.customer_last_name}`)
        console.log(`Items Detail (Keys):`, o.items_detail && o.items_detail[0] ? Object.keys(o.items_detail[0]) : 'empty')
        if (o.items_detail && o.items_detail[0]) {
            console.log(`Sample Item details:`, JSON.stringify(o.items_detail[0]).substring(0, 300))
        }
        console.log('---------------------------------')
    })
}

run()
