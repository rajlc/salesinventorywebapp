const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: tokens, error: err } = await supabase.from('daraz_api_tokens').select('*')
    if (err) {
        console.error('Error fetching tokens:', err)
    } else {
        console.log('\n--- daraz_api_tokens ---')
        console.table(tokens.map(t => ({
            id: t.id,
            store_id: t.store_id,
            app_type: t.app_type,
            seller_id: t.seller_id,
            account: t.account,
            has_token: !!t.access_token,
            expires_in: t.expires_in,
            refresh_token: !!t.refresh_token,
            updated_at: t.updated_at
        })))
    }
}

run()
