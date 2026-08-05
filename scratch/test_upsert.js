const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpsert() {
    const storeId = '1891e873-ee8d-4df4-b12e-0888ccdcd1db' // From the query parameters in the screenshot state
    const appType = 'chat'
    
    console.log('Attempting upsert on daraz_api_tokens for store_id:', storeId, 'app_type:', appType)
    
    const { data, error } = await supabase
        .from('daraz_api_tokens')
        .upsert({
            store_id: storeId,
            app_type: appType,
            access_token: 'test_access_token',
            refresh_token: 'test_refresh_token',
            expires_in: 2592000,
            token_type: 'Bearer',
            account: 'test@account.com',
            country: 'np',
            updated_at: new Date().toISOString()
        }, { onConflict: 'store_id,app_type' })
        .select()

    if (error) {
        console.error('Upsert failed with error:')
        console.error(JSON.stringify(error, null, 2))
    } else {
        console.log('Upsert succeeded!', data)
    }
}

testUpsert()
