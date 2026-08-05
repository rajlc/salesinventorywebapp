const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
        .from('daraz_orders')
        .select('order_number, order_status, items_detail, daraz_fees')
        .eq('order_status', 'Delivered')
        .limit(1)
    
    if (data && data[0]) {
        console.log('Order:', data[0].order_number)
        console.log('Items Detail:', JSON.stringify(data[0].items_detail, null, 2))
        console.log('Daraz Fees:', JSON.stringify(data[0].daraz_fees, null, 2))
    } else {
        console.log('No delivered order found or error:', error)
    }
}
check()
