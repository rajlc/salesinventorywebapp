const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    const { data, error } = await supabase.from('daraz_orders').select('*').limit(1)
    if (data && data[0]) {
        console.log(Object.keys(data[0]).join('\n'))
    } else {
        console.log('No data found or error:', error)
    }
}
check()
