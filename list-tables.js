const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function listTables() {
    const { data, error } = await supabase.from('daraz_api_tokens').select('*').limit(1)
    if (error) {
        console.log('Error accessing daraz_api_tokens:', error.message)
    } else {
        console.log('daraz_api_tokens table exists.')
    }
}

listTables()
