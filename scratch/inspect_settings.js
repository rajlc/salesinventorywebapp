const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: settings, error: err } = await supabase.from('daraz_chat_settings').select('*')
    if (err) {
        console.error('Error fetching settings:', err)
    } else {
        console.log('\n--- daraz_chat_settings ---')
        console.log(settings)
    }
}

run()
