const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Fetching latest 200 orders to check digital_delivery_info...");
    const { data: orders, error } = await supabase
        .from('daraz_orders')
        .select('order_number, customer_name, items_detail')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    let hasEmailCount = 0;
    let emptyCount = 0;
    const samples = [];

    orders.forEach(o => {
        const items = o.items_detail || [];
        // Find if any item in the order has digital_delivery_info
        let email = null;
        for (const item of items) {
            if (item.digital_delivery_info && item.digital_delivery_info.trim()) {
                email = item.digital_delivery_info.trim();
                break;
            }
        }

        if (email) {
            hasEmailCount++;
            if (samples.length < 15) {
                samples.push({
                    order: o.order_number,
                    name: o.customer_name,
                    email
                });
            }
        } else {
            emptyCount++;
        }
    });

    console.log(`\nEmail detection stats (from digital_delivery_info):`);
    console.log(`- Orders with Email: ${hasEmailCount} / 200 (${(hasEmailCount/200*100).toFixed(1)}%)`);
    console.log(`- Orders without Email: ${emptyCount} / 200 (${(emptyCount/200*100).toFixed(1)}%)`);

    console.log(`\nSamples of emails found:`);
    console.table(samples);
}

run();
