const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const orderId = 'b3ac7d29-a034-44f6-85fa-d9d92c96e1d3';
    console.log(`Checking order ${orderId}...`);

    // Fetch order
    const { data: order, error: err1 } = await supabase
        .from('daraz_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (err1) {
        console.error('Order Fetch Error:', err1.message);
        return;
    }
    console.log('\nOrder details:', JSON.stringify({
        id: order.id,
        order_number: order.order_number,
        order_status: order.order_status,
        created_at: order.created_at
    }, null, 2));

    // Fetch items
    const { data: items, error: err2 } = await supabase
        .from('daraz_order_items')
        .select('*')
        .eq('order_id', orderId);

    if (err2) {
        console.error('Items Fetch Error:', err2.message);
        return;
    }

    console.log('\nOrder items:');
    for (const item of items) {
        console.log(JSON.stringify({
            id: item.id,
            seller_sku: item.seller_sku,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity
        }, null, 2));

        if (item.product_id) {
            // Check product type
            const { data: prod } = await supabase
                .from('products')
                .select('id, product_name, product_type, product_combos(child_product_id, quantity)')
                .eq('id', item.product_id)
                .single();
            console.log('Matched Product:', JSON.stringify(prod, null, 2));

            // Check purchase plans
            const { data: plans } = await supabase
                .from('purchase_plans')
                .select('*')
                .eq('product_id', item.product_id);
            console.log('Plans for parent:', JSON.stringify(plans, null, 2));

            if (prod && prod.product_combos && prod.product_combos.length > 0) {
                const childId = prod.product_combos[0].child_product_id;
                const { data: childPlans } = await supabase
                    .from('purchase_plans')
                    .select('*')
                    .eq('product_id', childId);
                console.log(`Plans for child (${childId}):`, JSON.stringify(childPlans, null, 2));
            }
        } else {
            console.log('⚠️ SKU matching failed! No product_id associated with this item.');
        }
    }
}

run().catch(console.error);
