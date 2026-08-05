
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase env vars')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
    console.log('Fetching one row from daraz_order_report_view...')

    const { data, error } = await supabase
        .from('daraz_order_report_view')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error:', error)
        return
    }

    if (!data || data.length === 0) {
        console.log('No data found in view.')
        return
    }

    const item = data[0]
    console.log('Keys found:', Object.keys(item))
    console.log('items_summary value:', JSON.stringify(item.items_summary, null, 2))
}

run()
