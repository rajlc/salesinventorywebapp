const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get column names from daraz_orders
    const { data: orderSample, error: orderErr } = await supabase
        .from('daraz_orders')
        .select('*')
        .limit(1);

    if (orderErr) {
        console.error('Error fetching order sample:', orderErr.message);
    } else if (orderSample && orderSample.length > 0) {
        console.log('Columns in daraz_orders:', Object.keys(orderSample[0]));
        console.log('Sample order details:', orderSample[0]);
    }

    // 2. Get column names from daraz_order_items
    const { data: itemSample, error: itemErr } = await supabase
        .from('daraz_order_items')
        .select('*')
        .limit(1);

    if (itemErr) {
        console.error('Error fetching item sample:', itemErr.message);
    } else if (itemSample && itemSample.length > 0) {
        console.log('Columns in daraz_order_items:', Object.keys(itemSample[0]));
        console.log('Sample item details:', itemSample[0]);
    }
}

check();
