// Inspect sessions that still show "Buyer undefined" or "Buyer [number]" in their title
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find sessions with bad titles
    const { data: sessions, error } = await supabase
        .from('daraz_chat_sessions')
        .select('session_id, buyer_id, title, store_id')
        .or('title.like.Buyer %,title.is.null,title.eq.undefined')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }
    
    console.log(`Found ${sessions.length} sessions with "Buyer" prefix titles.`);
    for (const s of sessions.slice(0, 10)) {
        console.log(`\nSession: ${s.session_id}`);
        console.log(`  Current title: "${s.title}"`);
        console.log(`  buyer_id: ${s.buyer_id}`);
        
        // Try to look them up in orders
        if (s.buyer_id) {
            const { data: orders } = await supabase
                .from('daraz_orders')
                .select('order_id, customer_name, shipping_name, customer_first_name, customer_last_name, items_detail')
                .contains('items_detail', JSON.stringify([{ buyer_id: Number(s.buyer_id) }]))
                .limit(1);
            
            if (orders && orders.length > 0) {
                const o = orders[0];
                console.log(`  ✅ Found order: customer_name="${o.customer_name}", shipping_name="${o.shipping_name}"`);
            } else {
                console.log(`  ❌ No orders found with buyer_id=${s.buyer_id}`);
                
                // Try alternate lookup
                const { data: orders2 } = await supabase
                    .from('daraz_orders')
                    .select('order_id, customer_name, shipping_name, items_detail')
                    .limit(1)
                    .ilike('items_detail::text', `%"buyer_id":${s.buyer_id}%`);
                
                if (orders2 && orders2.length > 0) {
                    console.log(`  ✅ Found via ilike: customer_name="${orders2[0].customer_name}"`);
                    console.log(`  items_detail sample: ${JSON.stringify(orders2[0].items_detail?.[0]).substring(0,200)}`);
                } else {
                    console.log(`  ❌ Also not found via ilike`);
                }
            }
        }
    }
}

run();
