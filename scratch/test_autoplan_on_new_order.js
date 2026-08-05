const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// We mirror the autoPlanPurchaseForOrder code to trace execution
async function getActiveDemandForProduct(productId) {
    console.log(`Calculating active demand for product: ${productId}`);

    // 1. Direct demand
    const { data: directItems, error: directErr } = await supabase
        .from('daraz_order_items')
        .select('quantity, daraz_orders!inner(id, order_status)')
        .eq('product_id', productId)
        .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship']);

    if (directErr) {
        console.error('Direct demand query error:', directErr);
        return 0;
    }

    const directDemand = directItems ? directItems.reduce((s, i) => s + (i.quantity || 0), 0) : 0;
    console.log(`Direct active demand: ${directDemand}`);

    // 2. Combo demand
    const { data: parentCombos, error: comboErr } = await supabase
        .from('product_combos')
        .select('parent_product_id, quantity')
        .eq('child_product_id', productId);

    if (comboErr) {
        console.error('Combo combos query error:', comboErr);
        return directDemand;
    }

    let comboDemand = 0;
    if (parentCombos && parentCombos.length > 0) {
        const parentIds = parentCombos.map(c => c.parent_product_id);
        console.log(`Child product is in ${parentIds.length} parent combo(s):`, parentIds);

        const { data: parentItems, error: parentErr } = await supabase
            .from('daraz_order_items')
            .select('product_id, quantity, daraz_orders!inner(id, order_status)')
            .in('product_id', parentIds)
            .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship']);

        if (parentErr) {
            console.error('Parent items query error:', parentErr);
        } else if (parentItems) {
            console.log(`Found ${parentItems.length} active order items for parent combos`);
            parentItems.forEach(item => {
                const combo = parentCombos.find(c => c.parent_product_id === item.product_id);
                if (combo) {
                    comboDemand += (item.quantity || 0) * (combo.quantity || 0);
                }
            });
        }
    }

    const totalDemand = directDemand + comboDemand;
    console.log(`Total active demand (direct: ${directDemand} + combo: ${comboDemand}) = ${totalDemand}`);
    return totalDemand;
}

async function getProductPurchaseStatsInternal(productId) {
    const { data: latest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('purchase_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: lowest } = await supabase
        .from('purchases')
        .select('unit_amount, supplier:suppliers(supplier_name)')
        .eq('product_id', productId)
        .order('unit_amount', { ascending: true })
        .limit(1)
        .maybeSingle();

    return {
        latestPrice: latest?.unit_amount || 0,
        latestSupplier: (Array.isArray(latest?.supplier)
            ? latest?.supplier[0]?.supplier_name
            : latest?.supplier?.supplier_name) || '',
        lowPrice: lowest?.unit_amount || 0,
        lowSupplier: (Array.isArray(lowest?.supplier)
            ? lowest?.supplier[0]?.supplier_name
            : lowest?.supplier?.supplier_name) || '',
    };
}

async function run() {
    const orderId = 'e00606cc-94e5-428e-85fd-4aa008d3a1e8';
    console.log(`Running dry run of autoPlanPurchaseForOrder for order ${orderId}...`);

    const { data: orderItems, error: itemsError } = await supabase
        .from('daraz_order_items')
        .select('product_id, product_name, quantity')
        .eq('order_id', orderId);

    if (itemsError) {
        console.error('Error fetching order items:', itemsError.message);
        return;
    }

    console.log('Order Items:', orderItems);

    const productIds = [...new Set(orderItems.map(i => i.product_id).filter(Boolean))];
    console.log('Product IDs:', productIds);

    for (const productId of productIds) {
        const { data: product, error: prodErr } = await supabase
            .from('products')
            .select(`
                id,
                product_name,
                product_type,
                product_combos:product_combos!product_combos_parent_product_id_fkey(
                    child_product_id,
                    quantity
                )
            `)
            .eq('id', productId)
            .maybeSingle();

        if (prodErr || !product) {
            console.error('Product fetch error:', prodErr?.message);
            continue;
        }

        const isCombo = product.product_type === 'combo';
        const componentsCount = (product.product_combos || []).length;
        const isVariation = isCombo && componentsCount === 1;

        console.log(`Product: "${product.product_name}" | isCombo=${isCombo} | componentsCount=${componentsCount} | isVariation=${isVariation}`);

        if (isVariation) {
            const comp = product.product_combos[0];
            const childProductId = comp.child_product_id;
            console.log(`Variation detected. Child product ID: ${childProductId}`);

            const demand = await getActiveDemandForProduct(childProductId);
            console.log(`Child product demand: ${demand}`);

            const { data: existingPlan, error: planErr } = await supabase
                .from('purchase_plans')
                .select('id, status, quantity, remarks')
                .eq('product_id', childProductId)
                .in('status', ['Pending', 'Pending Confirmation'])
                .maybeSingle();

            if (planErr) {
                console.error('Plan fetch error:', planErr.message);
            }
            console.log('Existing plan:', existingPlan);

            if (demand > 0) {
                if (existingPlan) {
                    console.log(`Action: Would UPDATE plan ${existingPlan.id} quantity to ${demand}`);
                } else {
                    console.log('Action: Would CREATE new Pending Confirmation plan');
                    const stats = await getProductPurchaseStatsInternal(childProductId);
                    const insertPayload = {
                        plan_date: new Date().toLocaleDateString('en-CA'),
                        product_id: childProductId,
                        quantity: demand,
                        status: 'Pending Confirmation',
                        remarks: 'Auto-planned variation (Pending Confirmation)',
                        snapshot_latest_price: stats.latestPrice,
                        snapshot_latest_supplier: stats.latestSupplier,
                        snapshot_low_price: stats.lowPrice,
                        snapshot_low_supplier: stats.lowSupplier,
                    };
                    console.log('Insert payload:', insertPayload);
                }
            } else {
                console.log('Demand is 0, nothing to plan.');
            }
        } else {
            // Combo or Single
            const targets = isCombo ? product.product_combos.map(c => c.child_product_id) : [product.id];
            for (const targetId of targets) {
                console.log(`Processing component/product: ${targetId}`);
                const demand = await getActiveDemandForProduct(targetId);
                const { data: stockRow } = await supabase
                    .from('stock_ledger_view')
                    .select('total_stock')
                    .eq('id', targetId)
                    .maybeSingle();
                const stock = Number(stockRow?.total_stock) || 0;
                const needed = demand - stock;
                console.log(`  demand: ${demand}, stock: ${stock}, needed: ${needed}`);

                const { data: existingPlan, error: planErr } = await supabase
                    .from('purchase_plans')
                    .select('id, status, quantity, remarks')
                    .eq('product_id', targetId)
                    .in('status', ['Pending', 'Pending Confirmation'])
                    .maybeSingle();
                if (planErr) console.error('Plan query err:', planErr);
                console.log('  Existing plan:', existingPlan);

                if (needed > 0) {
                    if (existingPlan) {
                        console.log(`  Action: Updating plan ${existingPlan.id} quantity to ${needed}`);
                        const { data: updateRes, error: updErr } = await supabase
                            .from('purchase_plans')
                            .update({ quantity: needed, updated_at: new Date().toISOString() })
                            .eq('id', existingPlan.id)
                            .select();
                        if (updErr) console.error('  ❌ Update error:', updErr);
                        else console.log('  ✅ Updated:', updateRes);
                    } else {
                        console.log(`  Action: Creating new Pending plan with qty ${needed}`);
                        const stats = await getProductPurchaseStatsInternal(targetId);
                        const insertPayload = {
                            plan_date: new Date().toLocaleDateString('en-CA'),
                            product_id: targetId,
                            quantity: needed,
                            status: 'Pending',
                            remarks: 'Auto-planned from order demand',
                            snapshot_latest_price: stats.latestPrice,
                            snapshot_latest_supplier: stats.latestSupplier,
                            snapshot_low_price: stats.lowPrice,
                            snapshot_low_supplier: stats.lowSupplier,
                        };
                        const { data: insertRes, error: insErr } = await supabase
                            .from('purchase_plans')
                            .insert(insertPayload)
                            .select();
                        if (insErr) console.error('  ❌ Insert error:', insErr);
                        else console.log('  ✅ Inserted:', insertRes);
                    }
                } else {
                    console.log(`  Action: Stock sufficient (needed: ${needed}). No plan created.`);
                }
            }
        }
    }
}

run().catch(console.error);
