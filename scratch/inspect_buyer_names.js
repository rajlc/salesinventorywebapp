const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all chat sessions
    const { data: sessions, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('*')
        .order('last_message_time', { ascending: false });

    if (sessErr) {
        console.error('Error fetching sessions:', sessErr);
        return;
    }

    console.log(`Fetched ${sessions.length} sessions. Fetching all orders to match in memory...`);

    // Fetch orders in chunks if there are many, but let's fetch first 1000 orders
    const { data: orders, error: orderErr } = await supabase
        .from('daraz_orders')
        .select('order_id, customer_name, customer_first_name, customer_last_name, shipping_name, items_detail')
        .order('daraz_created_at', { ascending: false })
        .limit(1000);

    if (orderErr) {
        console.error('Error fetching orders:', orderErr);
        return;
    }

    console.log(`Fetched ${orders.length} orders. Performing matching...`);

    let matchCount = 0;
    for (const session of sessions) {
        const buyerId = session.buyer_id;
        if (!buyerId || buyerId === 'undefined') {
            continue;
        }

        // Find matching orders
        const matchedOrders = orders.filter(o => {
            if (!o.items_detail || !Array.isArray(o.items_detail)) return false;
            return o.items_detail.some(it => String(it.buyer_id) === buyerId);
        });

        if (matchedOrders.length > 0) {
            matchCount++;
            console.log(`\nSession ID: ${session.session_id}`);
            console.log(`Current Title: ${session.title}`);
            console.log(`Buyer ID: ${buyerId}`);
            console.log(`Found ${matchedOrders.length} matching orders:`);
            matchedOrders.forEach(o => {
                console.log(` - Order ID: ${o.order_id}`);
                console.log(`   Customer Name: ${o.customer_name}`);
                console.log(`   Shipping Name: ${o.shipping_name}`);
                console.log(`   First/Last Name: ${o.customer_first_name} ${o.customer_last_name}`);
            });
        }
    }

    console.log(`\nDone. Matched ${matchCount} out of ${sessions.length} sessions.`);
}

run();
