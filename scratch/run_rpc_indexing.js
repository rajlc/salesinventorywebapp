const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is missing from .env.local!');
        return;
    }

    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sql = `
        -- Index to optimize products sorting & filtering
        CREATE INDEX IF NOT EXISTS idx_products_status_sync_sort 
        ON public.products(approval_status DESC, marketplace_sync_status DESC, website_sync_status DESC, product_name ASC) 
        WHERE is_deleted = false;

        -- Index to optimize live prices lookup by sku
        CREATE INDEX IF NOT EXISTS idx_daraz_live_prices_seller_sku 
        ON public.daraz_live_prices(seller_sku);
    `;

    console.log('Attempting to execute SQL via exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ exec_sql RPC execution failed:', error.message);
        console.log('We will try database-level query or direct SQL if possible, but let\'s verify details.');
    } else {
        console.log('🎉 SUCCESS! Performance indexes created successfully via RPC!');
    }
}

run();
