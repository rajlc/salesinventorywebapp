const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Find product
    const { data: prods } = await supabase
        .from('products')
        .select('*')
        .ilike('product_name', '%Insect%')
        .limit(1);

    if (!prods || prods.length === 0) {
        console.log('Product not found');
        return;
    }

    const prod = prods[0];
    console.log('Product Found:', prod.product_name, 'ID:', prod.id);

    // Find its SKUs
    const skus = [prod.seller_sku1, prod.seller_sku2, prod.seller_sku3, prod.seller_sku4].filter(Boolean);
    console.log('SKUs:', skus);

    // 2. Fetch order items matching this product
    const { data: orderItems } = await supabase
        .from('daraz_order_items')
        .select('*, daraz_orders(*)')
        .or(`product_id.eq.${prod.id},seller_sku.in.(${skus.map(s => `"${s}"`).join(',')})`)
        .limit(20);

    console.log(`Found ${orderItems ? orderItems.length : 0} matching order items.`);
    if (orderItems && orderItems.length > 0) {
        console.log('Sample order items & order fees:');
        orderItems.forEach(item => {
            console.log({
                item_id: item.id,
                seller_sku: item.seller_sku,
                status: item.item_status || item.daraz_orders?.order_status,
                daraz_fees: item.daraz_orders?.daraz_fees,
                amount: item.amount,
                deleted: item.daraz_orders?.deleted
            });
        });
    }
}
run();
