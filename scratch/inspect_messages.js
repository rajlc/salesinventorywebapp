const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function inspect() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check count of messages today vs yesterday
    const { data: counts, error: countErr } = await supabase
        .from('daraz_chat_messages')
        .select('send_time')
    
    if (countErr) {
        console.error('Error fetching message times:', countErr)
        return
    }

    const stats = {}
    counts.forEach(c => {
        const dateStr = c.send_time.substring(0, 10)
        stats[dateStr] = (stats[dateStr] || 0) + 1
    })

    console.log('--- Messages Count by Date ---')
    console.log(stats)

    // Check if there are any errors or unprocessed entries in daraz_delayed_messages
    const { data: delayed, error: delayedErr } = await supabase
        .from('daraz_delayed_messages')
        .select('*')
        .limit(5)
    
    if (delayedErr) {
        console.error('Error fetching delayed messages:', delayedErr)
    } else {
        console.log('\n--- daraz_delayed_messages ---')
        console.log(delayed)
    }
}

inspect()
