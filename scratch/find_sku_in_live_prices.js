const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look for live prices matching starting parts of SKUs
    const searchSkus = ['1513670553', '185306992', '185465554'];
    
    console.log('Searching for SKUs matching prefixes:', searchSkus);
    
    const { data: matches, error } = await supabase
        .from('daraz_live_prices')
        .select('*');
        
    if (error) {
        console.error('Error fetching live prices:', error.message);
        return;
    }

    console.log(`Total live prices cached: ${matches.length}`);

    searchSkus.forEach(prefix => {
        const filtered = matches.filter(m => m.seller_sku && m.seller_sku.toLowerCase().includes(prefix.toLowerCase()));
        console.log(`\nMatches for prefix "${prefix}":`);
        filtered.forEach(m => {
            console.log({
                store_name: m.store_name,
                seller_sku: m.seller_sku,
                sku_length: m.seller_sku.length,
                price: m.price,
                special_price: m.special_price
            });
        });
    });
}
run();
