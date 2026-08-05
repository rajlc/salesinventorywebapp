import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    console.log('Inspecting inventory_price_reports_view columns and format...')
    
    const { data, error } = await supabase
        .from('inventory_price_reports_view')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error fetching view sample:', error)
        return
    }

    console.log('Sample row from view:', JSON.stringify(data?.[0], null, 2))
}

run()
