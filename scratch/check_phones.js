const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data: orders, error } = await supabase
        .from('daraz_orders')
        .select('order_number, customer_name, shipping_phone, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Fetched ${orders.length} orders.`);
    
    let nullCount = 0;
    let maskedCount = 0;
    let normalCount = 0;
    
    const samples = [];

    orders.forEach(o => {
        const phone = o.shipping_phone;
        if (!phone) {
            nullCount++;
        } else if (phone.includes('*') || phone.length < 7) {
            maskedCount++;
            if (samples.length < 15) samples.push({ order: o.order_number, name: o.customer_name, phone, status: 'masked' });
        } else {
            normalCount++;
            if (samples.length < 15) samples.push({ order: o.order_number, name: o.customer_name, phone, status: 'normal' });
        }
    });

    console.log(`\nPhone number stats:`);
    console.log(`- Null: ${nullCount}`);
    console.log(`- Masked (contains *): ${maskedCount}`);
    console.log(`- Normal/Unmasked: ${normalCount}`);
    
    console.log(`\nSamples:`);
    console.table(samples);
}

run();
