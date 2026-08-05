const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const orderId = '215814324047048'
    console.log(`Checking order: ${orderId}...`)

    // 1. Check if order is synced
    const { data: order, error: orderErr } = await supabase
        .from('daraz_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle()

    if (orderErr) {
        console.error('Error fetching order:', orderErr)
    } else {
        console.log('Order in daraz_orders:', order ? {
            id: order.id,
            status: order.status,
            customer_name: order.customer_name,
            created_at: order.created_at
        } : 'NOT FOUND')
    }

    // 2. Check delayed message queue
    const { data: queueItems, error: queueErr } = await supabase
        .from('daraz_delayed_messages')
        .select('*')
        .eq('order_id', orderId)

    if (queueErr) {
        console.error('Error fetching delayed messages:', queueErr)
    } else {
        console.log(`Delayed messages found in queue: ${queueItems.length}`)
        queueItems.forEach(item => {
            console.log({
                id: item.id,
                status: item.status,
                scheduled_at: item.scheduled_at,
                txt: item.txt,
                error_message: item.error_message,
                updated_at: item.updated_at
            })
        })
    }
}

run()
