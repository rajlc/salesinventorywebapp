const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    const { data: companies, error: compErr } = await supabase.from('company_details').select('*')
    if (compErr) {
        console.error('Error fetching companies:', compErr)
    } else {
        console.log('\n--- company_details ---')
        console.table(companies.map(c => ({ id: c.id, company_name: c.company_name, pan_vat_no: c.pan_vat_no })))
    }

    const { data: stores, error: storeErr } = await supabase.from('online_stores').select('*')
    if (storeErr) {
        console.error('Error fetching online stores:', storeErr)
    } else {
        console.log('\n--- online_stores ---')
        console.table(stores.map(s => ({ id: s.id, seller_account: s.seller_account, company_name: s.company_name })))
    }
}

run()
