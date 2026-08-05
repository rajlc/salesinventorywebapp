const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
        .from('daraz_orders')
        .select('order_number, order_status, price, customer_return_delivered_at')
        .eq('order_status', 'Customer Returned Delivered')
        .limit(1)
    
    if (data && data[0]) {
        console.log('Order:', data[0])
    } else {
        console.log('No Customer Returned Delivered order found or error:', error)
    }
}
check()
