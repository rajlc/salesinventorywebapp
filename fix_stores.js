const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
    console.log('Updating Balaju Shop company_name in online_stores...')
    const { data, error } = await supabase
        .from('online_stores')
        .update({ company_name: 'Bagmati Traders & Suppliers' })
        .eq('seller_account', 'Balaju Shop')
        .select()

    if (error) {
        console.error('Error updating database:', error)
    } else {
        console.log('Update successful:', data)
    }
}

run()
