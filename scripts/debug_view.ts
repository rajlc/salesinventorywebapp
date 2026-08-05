
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugView() {
    console.log('Inspecting daily_sales_stats_view...')
    const { data, error } = await supabase
        .from('daily_sales_stats_view')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('View Data Sample:', data)
        if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]))
        }
    }
}

debugView()
