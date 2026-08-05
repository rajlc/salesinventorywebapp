const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Connecting to:', supabaseUrl)
    
    // 1. Count messages by status
    const { data: countData, error: countErr } = await supabase
        .from('daraz_delayed_messages')
        .select('status')
    
    if (countErr) {
        console.error('Error fetching counts:', countErr)
        return
    }

    const counts = countData.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1
        return acc
    }, {})

    console.log('Current message statuses in DB:', counts)

    // 2. Cancel all pending and processing messages
    console.log('Cancelling all pending and processing messages...')
    const { data: updated, error: updateErr } = await supabase
        .from('daraz_delayed_messages')
        .update({ status: 'failed', error_message: 'Cancelled by admin to stop invitation loop' })
        .in('status', ['pending', 'processing'])
        .select('id, order_id, status')

    if (updateErr) {
        console.error('Error updating statuses:', updateErr)
    } else {
        console.log(`Successfully cancelled ${updated?.length || 0} messages.`)
        if (updated && updated.length > 0) {
            console.log('Cancelled items sample:', updated.slice(0, 5))
        }
    }
}

run()
