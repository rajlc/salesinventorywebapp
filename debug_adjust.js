const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shblzjrzulnrsarfxptv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCT_ID_INT = 14784;

async function debugProduct() {
    console.log('--- Debugging Product ID:', PRODUCT_ID_INT, '---');

    // 1. Get UUID of product
    const { data: product, error: pError } = await supabase
        .from('products')
        .select('id, product_name')
        .eq('product_id', PRODUCT_ID_INT)
        .single();

    if (pError || !product) {
        console.error('Product not found:', pError);
        return;
    }

    const productId = product.id;
    console.log('UUID:', productId);
    console.log('Name:', product.product_name);

    // 2. SQL Migration Logic (Broken version)
    // - Case sensitive, no lower()
    // - status IN ('Shipped', 'Delivered', 'Returning to Seller') -> negative
    // - status IN ('Fail Delivered', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered') -> positive

    const { data: combos } = await supabase
        .from('product_combos')
        .select('parent_product_id, quantity')
        .eq('child_product_id', productId);

    console.log('Combos found:', combos?.length || 0);
    const parentIds = combos?.map(c => c.parent_product_id) || [];

    if (parentIds.length === 0) {
        console.log('No combos found.');
        return;
    }

    // Fetch orders for all parents
    const { data: darazItems } = await supabase.from('daraz_order_items').select('product_id, quantity, order:daraz_orders!inner(order_status)').in('product_id', parentIds);
    const { data: mktItems } = await supabase.from('marketplace_order_items').select('product_id, quantity, order:marketplace_orders!inner(order_status)').in('product_id', parentIds);
    const { data: storeItems } = await supabase.from('store_sales_items').select('product_id, qty').in('product_id', parentIds);

    let sqlAutoAdjust = 0;
    let tsAutoAdjust = 0;

    const process = (items, platform) => {
        items?.forEach(item => {
            const parentQty = item.quantity || item.qty || 0;
            const status = item.order?.order_status || (platform === 'store' ? 'Completed' : '');
            const combo = combos.find(c => c.parent_product_id === item.product_id);
            const childQtyInCombo = combo.quantity || 0;
            const totalChildQty = parentQty * childQtyInCombo;

            // Old SQL Logic (Case sensitive)
            if (platform === 'store' || ['Shipped', 'Delivered', 'Returning to Seller'].includes(status)) {
                sqlAutoAdjust -= totalChildQty;
            } else if (['Fail Delivered', 'Returned Delivered', 'Customer Return', 'Customer Return Delivered'].includes(status)) {
                sqlAutoAdjust += totalChildQty;
            }

            // Old TS Logic (Lowercase)
            const lowerStatus = status.trim().toLowerCase();
            if (platform === 'store' || ['shipped', 'delivered', 'returning to seller', 'returning_to_seller'].includes(lowerStatus)) {
                tsAutoAdjust -= totalChildQty;
            } else if (['fail delivered', 'delivery failed', 'returned delivered', 'returned_delivered', 'customer return', 'customer_return', 'customer return delivered', 'customer_return_delivered', 'return delivered', 'returned'].includes(lowerStatus)) {
                tsAutoAdjust += totalChildQty;
            }
        });
    };

    process(darazItems, 'daraz');
    process(mktItems, 'marketplace');
    process(storeItems, 'store');

    console.log('SQL Auto Adjust (Calculated):', sqlAutoAdjust);
    console.log('TS Auto Adjust (Calculated):', tsAutoAdjust);

    // Also get the value CURRENTLY in the view
    const { data: viewData } = await supabase.from('stock_ledger_view').select('auto_adjust').eq('id', productId).single();
    console.log('Current SQL View value:', viewData?.auto_adjust);
}

debugProduct();
