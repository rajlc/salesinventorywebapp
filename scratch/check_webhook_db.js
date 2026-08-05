const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkDb() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Let's get the 10 most recent sessions in public.daraz_chat_sessions
    const { data: sessions, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('*')
        .order('last_message_time', { ascending: false })
        .limit(10)

    if (sessErr) {
        console.error('Error fetching sessions:', sessErr)
        return
    }

    console.log('--- Last 10 Sessions in Database ---')
    console.table(sessions.map(s => ({
        session_id: s.session_id,
        title: s.title,
        unread_count: s.unread_count,
        last_message_summary: s.last_message_summary,
        last_message_time: s.last_message_time,
        updated_at: s.updated_at
    })))
}

checkDb()
