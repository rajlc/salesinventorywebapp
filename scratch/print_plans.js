const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function getActiveDemandForProduct(productId, productName) {
    let totalDemand = 0;

    // 1. Direct demand
    let query = supabase
        .from('daraz_order_items')
        .select('quantity, daraz_orders!inner(order_status)')
        .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship']);

    if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
        query = query.eq('product_id', productId);
    } else if (productName) {
        query = query.eq('product_name', productName);
    }

    const { data: directItems, error: directErr } = await query;
    if (!directErr && directItems) {
        totalDemand += directItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }

    // 2. Combo demand
    if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
        const { data: parentCombos } = await supabase
            .from('product_combos')
            .select('parent_product_id, quantity')
            .eq('child_product_id', productId);

        if (parentCombos && parentCombos.length > 0) {
            const parentIds = parentCombos.map(c => c.parent_product_id);
            const { data: parentItems } = await supabase
                .from('daraz_order_items')
                .select('product_id, quantity, daraz_orders!inner(order_status)')
                .in('product_id', parentIds)
                .in('daraz_orders.order_status', ['Pending', 'Packed', 'Ready to Ship']);

            if (parentItems && parentItems.length > 0) {
                parentItems.forEach(item => {
                    const combo = parentCombos.find(c => c.parent_product_id === item.product_id);
                    if (combo) {
                        totalDemand += (item.quantity || 0) * (combo.quantity || 0);
                    }
                });
            }
        }
    }

    return totalDemand;
}

async function getProductGlobalDemand(productId, productName) {
    try {
        let totalDemand = 0;
        const activeStatuses = ['Pending', 'Packed', 'Ready to Ship', 'pending', 'packed', 'ready_to_ship', 'rts', 'RTS'];

        // 1. Direct demand
        const { data: directItems } = await supabase
            .from('daraz_order_items')
            .select('quantity, item_status, product_id, product_name, daraz_orders(order_status)')
            .or(`product_id.eq.${productId},product_name.ilike.%${productName?.replace(/['"]/g, '')}%`);

        if (directItems && directItems.length > 0) {
            directItems.forEach(item => {
                const oStatus = item.daraz_orders?.order_status || item.item_status || '';
                if (activeStatuses.includes(oStatus)) {
                    totalDemand += (item.quantity || 0);
                }
            });
        }

        // 2. Combo demand (if this product is a component of parent combo products)
        if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
            const { data: parentCombos } = await supabase
                .from('product_combos')
                .select('parent_product_id, quantity')
                .eq('child_product_id', productId);

            if (parentCombos && parentCombos.length > 0) {
                const parentIds = parentCombos.map(c => c.parent_product_id);
                const { data: parentItems } = await supabase
                    .from('daraz_order_items')
                    .select('product_id, quantity, item_status, daraz_orders(order_status)')
                    .in('product_id', parentIds);

                if (parentItems && parentItems.length > 0) {
                    parentItems.forEach((item) => {
                        const oStatus = item.daraz_orders?.order_status || item.item_status || '';
                        if (activeStatuses.includes(oStatus)) {
                            const combo = parentCombos.find(c => c.parent_product_id === item.product_id);
                            if (combo) {
                                totalDemand += (item.quantity || 0) * (combo.quantity || 0);
                            }
                        }
                    });
                }
            }
        }

        return totalDemand;
    } catch (e) {
        console.error('Demand calc error:', e);
        return 0;
    }
}

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function getProductGlobalDemand(productId, productName) {
    try {
        let totalDemand = 0;
        const activeStatuses = ['Pending', 'Packed', 'Ready to Ship', 'pending', 'packed', 'ready_to_ship', 'rts', 'RTS'];

        let resolvedProductId = productId;
        let resolvedProductName = productName;

        // Step 0: Resolve real product UUID & name from products table
        if (productName || productId) {
            let pQuery = supabaseAnon.from('products').select('id, product_name');
            if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
                pQuery = pQuery.eq('id', productId);
            } else if (productName) {
                pQuery = pQuery.eq('product_name', productName.trim());
            }
            const { data: pData } = await pQuery.maybeSingle();
            if (pData) {
                resolvedProductId = pData.id || resolvedProductId;
                resolvedProductName = pData.product_name || resolvedProductName;
            }
        }

        // Step 1: Direct demand
        let directItems = [];
        if (resolvedProductId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedProductId)) {
            const { data } = await supabaseAnon
                .from('daraz_order_items')
                .select('quantity, item_status, daraz_orders!inner(order_status)')
                .eq('product_id', resolvedProductId)
                .in('daraz_orders.order_status', activeStatuses);
            if (data && data.length > 0) directItems = data;
        }

        if (directItems.length === 0 && resolvedProductName) {
            const stopWords = new Set(['pcs', 'set', 'with', 'for', 'and', 'all', 'the', 'small', 'size', '1pcs', '2pcs', 'pack', 'color', 'colour']);
            const significantWords = resolvedProductName
                .replace(/[\(\/\-\.,]/g, ' ')
                .split(/\s+/)
                .map(w => w.trim())
                .filter(w => w.length >= 4 && !stopWords.has(w.toLowerCase()));

            for (const word of significantWords) {
                const { data } = await supabaseAnon
                    .from('daraz_order_items')
                    .select('quantity, item_status, daraz_orders!inner(order_status)')
                    .ilike('product_name', `%${word}%`)
                    .in('daraz_orders.order_status', activeStatuses);

                if (data && data.length > 0) {
                    directItems = data;
                    break;
                }
            }
        }

        if (directItems.length === 0 && resolvedProductName) {
            const { data } = await supabaseAnon
                .from('daraz_order_items')
                .select('quantity, item_status, daraz_orders!inner(order_status)')
                .ilike('product_name', `%${resolvedProductName.trim()}%`)
                .in('daraz_orders.order_status', activeStatuses);
            if (data && data.length > 0) directItems = data;
        }

        if (directItems && directItems.length > 0) {
            totalDemand += directItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        }

        // Step 2: Combo demand
        if (resolvedProductId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedProductId)) {
            const { data: parentCombos } = await supabaseAnon
                .from('product_combos')
                .select('parent_product_id, quantity')
                .eq('child_product_id', resolvedProductId);

            if (parentCombos && parentCombos.length > 0) {
                const parentIds = parentCombos.map(c => c.parent_product_id);
                const { data: parentItems } = await supabaseAnon
                    .from('daraz_order_items')
                    .select('product_id, quantity, item_status, daraz_orders!inner(order_status)')
                    .in('product_id', parentIds)
                    .in('daraz_orders.order_status', activeStatuses);

                if (parentItems && parentItems.length > 0) {
                    parentItems.forEach((item) => {
                        const combo = parentCombos.find(c => c.parent_product_id === item.product_id);
                        if (combo) {
                            totalDemand += (item.quantity || 0) * (combo.quantity || 0);
                        }
                    });
                }
            }
        }

        return totalDemand;
    } catch (e) {
        console.error(e);
        return 0;
    }
}

async function getLatestActiveSalesForProduct(productId, productName, remarks) {
    try {
        const activeStatuses = ['Pending', 'Packed', 'Ready to Ship', 'pending', 'packed', 'ready_to_ship', 'rts', 'RTS'];
        const matchedItemIds = new Set();
        const results = [];

        const namesToQuery = new Set();
        if (productName && productName.trim()) {
            namesToQuery.add(productName.trim());
            const baseTitle = productName.split(/[\(\/\-]/)[0].trim();
            if (baseTitle && baseTitle.length > 3) {
                namesToQuery.add(baseTitle);
            }
        }

        if (remarks && typeof remarks === 'string') {
            const remarksItems = remarks.split(',').map(s => s.trim()).filter(s => s.length > 3 && !s.toLowerCase().includes('auto-planned'));
            remarksItems.forEach(item => {
                namesToQuery.add(item);
                const baseItem = item.split(/[\(\/\-]/)[0].trim();
                if (baseItem && baseItem.length > 3) {
                    namesToQuery.add(baseItem);
                }
            });
        }

        const processItems = (items) => {
            if (!items || items.length === 0) return;
            items.forEach(item => {
                if (!matchedItemIds.has(item.id)) {
                    matchedItemIds.add(item.id);
                    const oDate = item.daraz_orders?.order_date || item.created_at?.split('T')[0] || '';
                    const oStatus = item.daraz_orders?.order_status || 'Pending';
                    const oQty = item.quantity || 1;
                    const oAmount = item.total_amount || item.amount || 0;
                    results.push({
                        id: item.id,
                        order_date: oDate,
                        quantity: oQty,
                        amount: oAmount,
                        order_status: oStatus
                    });
                }
            });
        };

        // 1. Direct by product_id
        if (productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
            const { data } = await supabaseAnon
                .from('daraz_order_items')
                .select('id, quantity, amount, total_amount, created_at, daraz_orders!inner(order_date, order_status)')
                .eq('product_id', productId)
                .in('daraz_orders.order_status', activeStatuses);
            processItems(data);
        }

        // 2. By names and variation names in remarks
        for (const name of Array.from(namesToQuery)) {
            const { data: exactData } = await supabaseAnon
                .from('daraz_order_items')
                .select('id, quantity, amount, total_amount, created_at, daraz_orders!inner(order_date, order_status)')
                .eq('product_name', name)
                .in('daraz_orders.order_status', activeStatuses);
            processItems(exactData);

            const { data: ilikeData } = await supabaseAnon
                .from('daraz_order_items')
                .select('id, quantity, amount, total_amount, created_at, daraz_orders!inner(order_date, order_status)')
                .ilike('product_name', `%${name}%`)
                .in('daraz_orders.order_status', activeStatuses);
            processItems(ilikeData);
        }

        // Sort descending by order_date
        results.sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
        return results;
    } catch (e) {
        console.error('Error in getLatestActiveSalesForProduct:', e);
        return [];
    }
}

async function run() {
    console.log('--- Inspecting daraz_orders columns ---');
    const { data } = await supabaseAnon
        .from('daraz_orders')
        .select('*')
        .limit(1);
    console.log('Sample daraz_order:', data ? data[0] : 'No data');
}
run();
