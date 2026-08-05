const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: products } = await supabase.from('products').select('id, seller_account1, seller_account2, seller_account3, seller_account4, is_deleted, status');
    console.log('Total products:', products.length);

    const storeCounts = {};
    for (const p of products) {
        if (p.is_deleted || p.status !== 'Active') continue;
        const accounts = new Set([p.seller_account1, p.seller_account2, p.seller_account3, p.seller_account4].filter(Boolean));
        for (const acc of accounts) {
            storeCounts[acc] = (storeCounts[acc] || 0) + 1;
        }
    }
    console.log('Active product count per seller account:', storeCounts);
}

run();
