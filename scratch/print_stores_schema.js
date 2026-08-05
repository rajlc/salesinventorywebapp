const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Connecting to:', supabaseUrl)
    const { data: stores, error: storeErr } = await supabase.from('online_stores').select('*').limit(1)
    if (storeErr) {
        console.error('Error fetching online stores:', storeErr)
    } else if (stores && stores.length > 0) {
        console.log('\n--- online_stores row schema ---')
        console.log(Object.keys(stores[0]))
        console.log('Sample row data:', stores[0])
    } else {
        console.log('No online stores found in DB')
    }

    const { data: settings, error: setErr } = await supabase.from('daraz_chat_settings').select('*').limit(1)
    if (setErr) {
        console.error('Error fetching daraz_chat_settings:', setErr)
    } else if (settings && settings.length > 0) {
        console.log('\n--- daraz_chat_settings row schema ---')
        console.log(Object.keys(settings[0]))
        console.log('Sample row data:', settings[0])
    } else {
        console.log('No chat settings found in DB')
    }
}

run()
