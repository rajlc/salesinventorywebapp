const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase.from('daraz_orders_with_totals').select('*').limit(1)
    if (error) {
        console.error('Error:', error)
    } else if (data && data[0]) {
        console.log('Columns in daraz_orders_with_totals:', Object.keys(data[0]).join(', '))
        console.log('Sample data remarks field:', data[0].remarks)
    } else {
        console.log('No data found.')
    }
}
check()
