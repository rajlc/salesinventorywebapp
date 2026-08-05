/**
 * Test: Simulate autoPlanPurchaseForOrder against the live DB
 * This mimics what happens when an order is synced, but uses the FIXED two-step query logic.
 * Run: node scratch/test_autoplan_fixed.js <internal-order-uuid>
 * Or without args: uses the most recent Pending/Packed order automatically.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// ---- Helpers (mirrors auto-plan-utils.ts logic) ----

async function getActiveDemandForProduct(productId) {
    const { data: directItems } = await supabase
        .from('daraz_order_items')
        .select('quantity, order_id')
        .eq('product_id', productId);

    if (!directItems || directItems.length === 0) return 0;

    const orderIds = directItems.map(i => i.order_id).filter(Boolean);
    const { data: activeOrders } = await supabase
        .from('daraz_orders')
        .select('id, order_status')
        .in('id', orderIds)
        .in('order_status', ['Pending', 'Packed', 'Ready to Ship']);

    const activeOrderIds = new Set((activeOrders || []).map(o => o.id));
    const totalDemand = directItems
        .filter(i => activeOrderIds.has(i.order_id))
        .reduce((s, i) => s + (i.quantity || 0), 0);

    console.log(`    demand: ${totalDemand} (from ${directItems.length} total order items, ${activeOrders?.length || 0} active orders)`);
    return totalDemand;
}

async function getProductStock(productId) {
    const { data } = await supabase
        .from('stock_ledger_view')
        .select('total_stock')
        .eq('id', productId)
        .maybeSingle();
    return Number(data?.total_stock) || 0;
}

async function processSingleProductAutoPlan(productId, dryRun) {
    const { data: product } = await supabase.from('products').select('id, product_name').eq('id', productId).maybeSingle();
    if (!product) { console.log(`    ⚠️  Product ${productId} not found`); return; }

    const demand = await getActiveDemandForProduct(productId);
    const stock = await getProductStock(productId);
    const needed = demand - stock;
    console.log(`    "${product.product_name}": demand=${demand}, stock=${stock}, needed=${needed}`);

    const { data: existingPlan } = await supabase
        .from('purchase_plans')
        .select('id, status, quantity, remarks')
        .eq('product_id', productId)
        .in('status', ['Pending', 'Pending Confirmation'])
        .maybeSingle();

    if (needed > 0) {
        if (existingPlan) {
            console.log(`    → Would UPDATE existing plan (id: ${existingPlan.id}) to qty=${needed}`);
            if (!dryRun) {
                const { error } = await supabase.from('purchase_plans').update({ quantity: needed, updated_at: new Date().toISOString() }).eq('id', existingPlan.id);
                if (error) console.error('    UPDATE ERROR:', error.message);
                else console.log('    ✅ Updated!');
            }
        } else {
            console.log(`    → Would CREATE new Pending plan with qty=${needed}`);
            if (!dryRun) {
                const { error } = await supabase.from('purchase_plans').insert({
                    plan_date: new Date().toLocaleDateString('en-CA'),
                    product_id: productId,
                    quantity: needed,
                    status: 'Pending',
                    remarks: 'Auto-planned from order demand',
                    snapshot_latest_price: 0,
                    snapshot_latest_supplier: '',
                    snapshot_low_price: 0,
                    snapshot_low_supplier: '',
                });
                if (error) console.error('    INSERT ERROR:', error.message);
                else console.log('    ✅ Created!');
            }
        }
    } else {
        console.log(`    → Stock sufficient (needed=${needed}). No plan created.`);
    }
}

async function run() {
    // Dry run by default — set to false to actually write to DB
    const DRY_RUN = process.argv.includes('--write') ? false : true;
    console.log(`\n[AutoPlan TEST] Mode: ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '✍️  WRITE MODE'}`);
    console.log('To write to DB: node scratch/test_autoplan_fixed.js --write\n');

    // Find a suitable test order (Pending or Packed)
    let orderId = process.argv[2];
    if (!orderId || orderId.startsWith('--')) {
        const { data: orders } = await supabase
            .from('daraz_orders')
            .select('id, order_id, order_status, created_at')
            .in('order_status', ['Pending', 'Packed', 'Ready to Ship'])
            .order('created_at', { ascending: false })
            .limit(5);

        console.log('Recent active orders:', orders?.map(o => `${o.order_id} (${o.order_status})`));

        if (!orders || orders.length === 0) {
            console.log('⚠️  No active (Pending/Packed/Ready to Ship) orders found. Cannot test.');
            return;
        }
        orderId = orders[0].id;
        console.log(`Using order UUID: ${orderId} (Daraz ID: ${orders[0].order_id})\n`);
    }

    // Get items for this order
    const { data: orderItems } = await supabase
        .from('daraz_order_items')
        .select('product_id, product_name, quantity')
        .eq('order_id', orderId);

    console.log('Order items:', orderItems?.map(i => `${i.product_name} (qty=${i.quantity}, product_id=${i.product_id})`));

    const productIds = [...new Set((orderItems || []).map(i => i.product_id).filter(Boolean))];
    if (productIds.length === 0) {
        console.log('\n⚠️  NO products matched (product_id is null). SKU matching failed!');
        console.log('This means the order items in Daraz do not match any product SKU in your inventory.');
        return;
    }

    for (const productId of productIds) {
        const { data: product } = await supabase
            .from('products')
            .select('id, product_name, product_type, product_combos:product_combos!product_combos_parent_product_id_fkey(child_product_id, quantity)')
            .eq('id', productId)
            .maybeSingle();

        if (!product) { console.log(`\n⚠️  Product ${productId} not in inventory`); continue; }

        const isCombo = product.product_type === 'combo';
        const componentsCount = (product.product_combos || []).length;
        const isVariation = isCombo && componentsCount === 1;

        console.log(`\nProduct: "${product.product_name}" | type=${product.product_type} | components=${componentsCount} | isVariation=${isVariation}`);

        if (isVariation) {
            const demand = await getActiveDemandForProduct(product.id);
            console.log(`  Variation — demand=${demand}. Would create 'Pending Confirmation' plan`);
        } else if (isCombo) {
            for (const comp of (product.product_combos || [])) {
                console.log(`  Combo component: ${comp.child_product_id}`);
                await processSingleProductAutoPlan(comp.child_product_id, DRY_RUN);
            }
        } else {
            await processSingleProductAutoPlan(product.id, DRY_RUN);
        }
    }

    console.log('\n[AutoPlan TEST] Complete!');
}

run().catch(console.error);
