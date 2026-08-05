/**
 * Diagnostic: Test Auto Purchase Plan Logic Against Live DB
 * Run: node scratch/test_autoplan_logic.js
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function run() {
    console.log('\n===== STEP 1: Check recent daraz_orders =====');
    const { data: recentOrders, error: e1 } = await supabase
        .from('daraz_orders')
        .select('id, order_id, order_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
    if (e1) console.error('ERROR:', e1.message);
    else console.log(JSON.stringify(recentOrders, null, 2));

    if (!recentOrders || recentOrders.length === 0) {
        console.log('No orders found. Exiting.');
        return;
    }

    const latestOrder = recentOrders[0];
    console.log(`\nUsing latest order: ${latestOrder.order_id} (status: ${latestOrder.order_status})`);

    console.log('\n===== STEP 2: Check daraz_order_items for this order =====');
    const { data: items, error: e2 } = await supabase
        .from('daraz_order_items')
        .select('id, product_id, product_name, quantity, status')
        .eq('order_id', latestOrder.id);
    if (e2) console.error('ERROR:', e2.message);
    else console.log(JSON.stringify(items, null, 2));

    if (!items || items.length === 0) {
        console.log('No items found for this order. Exiting.');
        return;
    }

    // For each item with a product_id, check stock
    for (const item of items) {
        if (!item.product_id) {
            console.log(`\n⚠️  Item "${item.product_name}" has NO product_id — SKU not matched!`);
            continue;
        }

        console.log(`\n===== STEP 3: Stock check for product: ${item.product_name} (${item.product_id}) =====`);
        const { data: stockRow, error: e3 } = await supabase
            .from('stock_ledger_view')
            .select('id, product_name, total_stock')
            .eq('id', item.product_id)
            .maybeSingle();
        if (e3) console.error('Stock ERROR:', e3.message);
        else console.log('Stock ledger row:', JSON.stringify(stockRow, null, 2));

        console.log(`\n===== STEP 4: Active demand for product =====`);
        // Direct demand (without join filter bug)
        const { data: directItems, error: e4 } = await supabase
            .from('daraz_order_items')
            .select('quantity, order_id')
            .eq('product_id', item.product_id);
        if (e4) console.error('Demand ERROR:', e4.message);
        else {
            const totalQty = (directItems || []).reduce((s, r) => s + (r.quantity || 0), 0);
            console.log(`  Total quantity across ALL orders (no status filter): ${totalQty}`);
            console.log(`  Raw rows:`, JSON.stringify(directItems, null, 2));
        }

        // Check active orders specifically
        const orderIds = (directItems || []).map(r => r.order_id);
        if (orderIds.length > 0) {
            const { data: orderStatuses, error: e5 } = await supabase
                .from('daraz_orders')
                .select('id, order_status')
                .in('id', orderIds);
            if (e5) console.error('Order status ERROR:', e5.message);
            else console.log('  Order statuses:', JSON.stringify(orderStatuses, null, 2));
        }

        console.log(`\n===== STEP 5: Existing purchase plans for product =====`);
        const { data: plans, error: e6 } = await supabase
            .from('purchase_plans')
            .select('id, status, quantity, remarks, created_at')
            .eq('product_id', item.product_id);
        if (e6) console.error('Plans ERROR:', e6.message);
        else console.log(JSON.stringify(plans, null, 2));

        console.log(`\n===== STEP 6: Product type check =====`);
        const { data: prod, error: e7 } = await supabase
            .from('products')
            .select('id, product_name, product_type, product_combos:product_combos!product_combos_parent_product_id_fkey(child_product_id, quantity)')
            .eq('id', item.product_id)
            .maybeSingle();
        if (e7) console.error('Product ERROR:', e7.message);
        else console.log(JSON.stringify(prod, null, 2));
    }

    console.log('\n===== STEP 7: Check purchase_plans constraint =====');
    // Try inserting a plan with Pending Confirmation status (and roll back)
    const { data: constCheck, error: e8 } = await supabase
        .from('purchase_plans')
        .select('status')
        .in('status', ['Pending', 'Pending Confirmation', 'Complete', 'Cancel'])
        .limit(1);
    if (e8) console.error('Constraint check ERROR:', e8.message);
    else console.log('Constraint check PASSED — query worked:', constCheck);

    console.log('\n===== DIAGNOSTICS COMPLETE =====\n');
}

run().catch(console.error);
