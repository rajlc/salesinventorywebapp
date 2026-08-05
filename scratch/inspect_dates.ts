import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

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
    console.log('Running counts on daraz_orders...')

    // 1. Total Delivered Orders
    const { count: totalDelivered } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')
    console.log('Total Delivered Orders:', totalDelivered)

    // 2. Delivered Orders with order_date in May 15 to May 29
    const { count: orderDateCount } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')
        .gte('order_date', '2026-05-15')
        .lte('order_date', '2026-05-29')
    console.log('Delivered orders with order_date in last 14 days (May 15-29):', orderDateCount)

    // 3. Delivered Orders with shipped_at in May 15 to May 29
    const { count: shippedAtCount } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')
        .gte('shipped_at', '2026-05-15T00:00:00Z')
        .lte('shipped_at', '2026-05-29T23:59:59Z')
    console.log('Delivered orders with shipped_at in last 14 days (May 15-29):', shippedAtCount)

    // 4. Delivered Orders where shipped_at is NULL
    const { count: nullShippedCount } = await supabase
        .from('daraz_orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'Delivered')
        .is('shipped_at', null)
    console.log('Delivered orders with NULL shipped_at:', nullShippedCount)

    // 5. Sample delivered orders where shipped_at is NULL but order_date is in May
    if (nullShippedCount && nullShippedCount > 0) {
        const { data: samples } = await supabase
            .from('daraz_orders')
            .select('order_number, order_date, shipped_at, delivered_at')
            .eq('order_status', 'Delivered')
            .is('shipped_at', null)
            .gte('order_date', '2026-05-15')
            .limit(5)
        
        console.log('Sample delivered orders with NULL shipped_at from May:')
        console.log(samples)
    }
}

run()
