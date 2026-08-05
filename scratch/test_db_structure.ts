import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
    console.log('Inspecting daraz_order_items columns and sample data...')
    
    const { data: sampleItems, error } = await supabase
        .from('daraz_order_items')
        .select('*')
        .limit(5)

    if (error) {
        console.error('Error fetching sample:', error)
        return
    }

    console.log('Sample data from daraz_order_items:', JSON.stringify(sampleItems, null, 2))

    // Let's count how many rows have a matching product in products table
    const { data: countMatch, error: countErr } = await supabase
        .from('daraz_order_items')
        .select('product_id')
        .not('product_id', 'is', null)
        .limit(20)

    if (countErr) {
        console.error('Error fetching count:', countErr)
        return
    }
    
    console.log('Sample product_ids in daraz_order_items:', countMatch)

    // Let's fetch one matching product
    if (countMatch && countMatch.length > 0) {
        const pids = countMatch.map(c => c.product_id).filter(Boolean)
        const { data: matchedProducts } = await supabase
            .from('products')
            .select('id, product_name, seller_sku1')
            .in('id', pids)

        console.log('Matched products in products table by ID:', matchedProducts)
    }
}

run()
