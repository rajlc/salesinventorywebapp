const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log("Querying daraz_orders columns and test order...");
    const { data: order, error } = await supabase
        .from('daraz_orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching order:", error);
    } else {
        console.log("Order Columns:", Object.keys(order[0] || {}));
        console.log("Sample Order:", order[0]);
    }

    // Check if the user's specific order is in database
    const { data: specificOrder, error: specificError } = await supabase
        .from('daraz_orders')
        .select('*')
        .eq('order_id', '215814324047048')
        .maybeSingle();

    if (specificError) {
        console.error("Error fetching specific order:", specificError);
    } else {
        console.log("Specific Order 215814324047048:", specificOrder);
    }
}

check();
