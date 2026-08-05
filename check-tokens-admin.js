const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTokens() {
    const { data, error } = await supabase.from('daraz_api_tokens').select('*')
    if (error) {
        console.error('Error:', error)
        return
    }
    console.log('Daraz API Tokens (Service Role):')
    if (data.length === 0) {
        console.log('Table is EMPTY.')
    } else {
        data.forEach(t => {
            console.log(`- StoreID: ${t.store_id}, AccessToken: ${t.access_token ? t.access_token.substring(0, 10) + '...' : 'null'}`)
        })
    }
}

checkTokens()
