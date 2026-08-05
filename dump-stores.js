const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function dumpStores() {
    const { data, error } = await supabase.from('online_stores').select('*')
    if (error) {
        console.error('Error:', error)
        return
    }
    console.log('Online Stores List:')
    data.forEach(s => {
        console.log(`- ID: ${s.id}, SellerID: "${s.seller_id}", Account: "${s.seller_account}"`)
    })
}

dumpStores()
