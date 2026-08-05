const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching active products...');
    const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, seller_sku1, seller_sku2, seller_sku3, seller_sku4, product_name')
        .eq('is_deleted', false);

    if (pErr) {
        console.error('Error fetching products:', pErr.message);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No products found.');
        return;
    }

    console.log(`Found ${products.length} products. Recalculating commissions in chunks...`);

    const chunkSize = 50;
    let updatedCount = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);
        const chunkProductIds = chunk.map(p => p.id);
        
        console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(products.length / chunkSize)}...`);

        // Map SKUs to Product IDs
        const reverseSkuMap = new Map();
        const chunkSkus = [];
        chunk.forEach(s => {
            if (s.seller_sku1) {
                const sku = s.seller_sku1.toLowerCase().trim();
                reverseSkuMap.set(sku, s.id);
                chunkSkus.push(sku);
            }
            if (s.seller_sku2) {
                const sku = s.seller_sku2.toLowerCase().trim();
                reverseSkuMap.set(sku, s.id);
                chunkSkus.push(sku);
            }
            if (s.seller_sku3) {
                const sku = s.seller_sku3.toLowerCase().trim();
                reverseSkuMap.set(sku, s.id);
                chunkSkus.push(sku);
            }
            if (s.seller_sku4) {
                const sku = s.seller_sku4.toLowerCase().trim();
                reverseSkuMap.set(sku, s.id);
                chunkSkus.push(sku);
            }
        });

        // 1. Fetch delivered order items for this chunk
        const filters = [`product_id.in.(${chunkProductIds.map(id => `"${id}"`).join(',')})`];
        if (chunkSkus.length > 0) {
            filters.push(`seller_sku.in.(${chunkSkus.map(s => `"${s}"`).join(',')})`);
        }

        const { data: orderItems, error: oiErr } = await supabase
            .from('daraz_order_items')
            .select(`
                product_id,
                seller_sku,
                amount,
                quantity,
                order_id
            `)
            .or(filters.join(','))
            .limit(1000); // 1000 items per chunk

        if (oiErr) {
            console.error(`Error fetching order items for chunk:`, oiErr.message);
            continue;
        }

        if (!orderItems || orderItems.length === 0) {
            // No orders found for any of the products in this chunk, they keep the default 25.00%
            continue;
        }

        // 2. Fetch order fees for these orders
        const orderIds = Array.from(new Set(orderItems.map(item => item.order_id).filter(Boolean)));
        const orderFeesMap = new Map();
        
        // Fetch order fees in sub-chunks of 100
        const orderSubChunkSize = 100;
        for (let j = 0; j < orderIds.length; j += orderSubChunkSize) {
            const subChunk = orderIds.slice(j, j + orderSubChunkSize);
            const { data: ordersData } = await supabase
                .from('daraz_orders')
                .select('id, daraz_fees, order_status, deleted')
                .in('id', subChunk);
            
            if (ordersData) {
                ordersData.forEach(o => {
                    if (o.order_status === 'Delivered' && !o.deleted && o.daraz_fees !== null) {
                        orderFeesMap.set(o.id, Math.abs(o.daraz_fees));
                    }
                });
            }
        }

        // 3. Compile order total revenue and order items count
        const orderRevenueMap = new Map();
        const orderItemCountMap = new Map();

        orderItems.forEach(item => {
            if (!orderFeesMap.has(item.order_id)) return;
            const itemRevenue = (item.amount || 0) * (item.quantity || 1);
            orderRevenueMap.set(item.order_id, (orderRevenueMap.get(item.order_id) || 0) + itemRevenue);
            orderItemCountMap.set(item.order_id, (orderItemCountMap.get(item.order_id) || 0) + 1);
        });

        // 4. Group rates by product
        const productRatesMap = new Map();

        orderItems.forEach(item => {
            if (!orderFeesMap.has(item.order_id)) return;

            let pid = item.product_id;
            if (!pid && item.seller_sku) {
                pid = reverseSkuMap.get(item.seller_sku.toLowerCase().trim());
            }
            if (!pid || !chunkProductIds.includes(pid)) return;

            const orderFees = orderFeesMap.get(item.order_id);
            const orderRevenue = orderRevenueMap.get(item.order_id) || 0;
            const orderItemCount = orderItemCountMap.get(item.order_id) || 1;

            if (orderRevenue <= 0 || orderFees <= 0) return;

            const rate = (orderFees + 30) / orderRevenue;
            if (rate < 0.02 || rate > 0.65) return;

            if (!productRatesMap.has(pid)) {
                productRatesMap.set(pid, { singleItemRates: [], multiItemRates: [] });
            }

            const entry = productRatesMap.get(pid);
            if (orderItemCount === 1) {
                entry.singleItemRates.push(rate);
            } else {
                entry.multiItemRates.push(rate);
            }
        });

        // 5. Update chunk products
        for (const p of chunk) {
            const commData = productRatesMap.get(p.id);
            let commissionPercent = 25.00; // Default

            if (commData) {
                if (commData.singleItemRates.length > 0) {
                    const sum = commData.singleItemRates.reduce((a, b) => a + b, 0);
                    commissionPercent = (sum / commData.singleItemRates.length) * 100;
                } else if (commData.multiItemRates.length > 0) {
                    const sum = commData.multiItemRates.reduce((a, b) => a + b, 0);
                    commissionPercent = (sum / commData.multiItemRates.length) * 100;
                }
            }

            // Only update products that actually had sales to avoid updating defaults repeatedly
            if (commData) {
                const { error: updErr } = await supabase
                    .from('products')
                    .update({ commission_percent: parseFloat(commissionPercent.toFixed(2)) })
                    .eq('id', p.id);

                if (updErr) {
                    console.error(`Failed to update product ${p.product_name}:`, updErr.message);
                } else {
                    console.log(`Updated product: ${p.product_name} -> ${commissionPercent.toFixed(2)}%`);
                    updatedCount++;
                }
            }
        }
    }

    console.log(`Finished chunked recalculation. Recalculated rates for ${updatedCount} products.`);
}

run();
