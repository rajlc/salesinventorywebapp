const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase
        .from('daraz_orders')
        .select('order_number, items_detail')
        .eq('order_status', 'Delivered')
        .limit(1)
    
    if (data && data[0]) {
        const item = data[0].items_detail[0]
        const feeKeys = Object.keys(item).filter(k => 
            k.includes('fee') || 
            k.includes('amount') || 
            k.includes('discount') || 
            k.includes('voucher') || 
            k.includes('coin') ||
            k.includes('cost') ||
            k.includes('tax')
        )
        console.log('Fee-related keys in items_detail:', feeKeys)
        console.log('Sample values:', feeKeys.reduce((acc, k) => ({...acc, [k]: item[k]}), {}))
    } else {
        console.log('No delivered order found.')
    }
}
check()
