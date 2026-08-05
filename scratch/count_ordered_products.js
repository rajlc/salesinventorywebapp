const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: stores } = await supabase.from('online_stores').select('id, seller_account');
    
    for (const store of stores) {
        // Fetch orders for this store in the last 60 days
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data: orders, error } = await supabase
            .from('daraz_orders')
            .select('items_detail')
            .eq('store_id', store.id)
            .gte('order_date', sixtyDaysAgo.toISOString().split('T')[0]);

        if (error) {
            console.error(`Error for store ${store.seller_account}:`, error);
            continue;
        }

        const itemIds = new Set();
        for (const o of orders || []) {
            for (const item of o.items_detail || []) {
                const pid = item.product_id || item.ProductId;
                if (pid && String(pid).length > 6) {
                    itemIds.add(String(pid));
                }
            }
        }

        console.log(`Store: ${store.seller_account}`);
        console.log(`  Orders in last 60 days: ${orders.length}`);
        console.log(`  Unique ordered product IDs: ${itemIds.size}`);
    }
}

run();
