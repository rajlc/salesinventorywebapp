const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Connecting to:', supabaseUrl)
    
    // Find all rows in daraz_delayed_messages
    const { data: rows, error } = await supabase
        .from('daraz_delayed_messages')
        .select('order_id, status, created_at')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching rows:', error)
        return
    }

    console.log(`Total rows: ${rows.length}`)

    // Group by order_id
    const grouped = {}
    rows.forEach(r => {
        if (!grouped[r.order_id]) {
            grouped[r.order_id] = []
        }
        grouped[r.order_id].push(r)
    })

    // Find duplicates (orders with count > 1)
    const duplicates = Object.entries(grouped)
        .filter(([orderId, list]) => list.length > 1)
        .map(([orderId, list]) => ({
            order_id: orderId,
            count: list.length,
            statuses: list.map(l => l.status),
            created_times: list.map(l => l.created_at)
        }))

    console.log(`Number of orders with duplicates: ${duplicates.length}`)
    if (duplicates.length > 0) {
        console.log('Sample duplicates:', JSON.stringify(duplicates.slice(0, 10), null, 2))
    }
}

run()
