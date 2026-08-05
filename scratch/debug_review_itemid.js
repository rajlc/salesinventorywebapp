const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest';

function signRequest(apiName, params, appSecret) {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => { str += key + String(params[key]); });
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase();
}

async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Check what product_id looks like vs daraz order item ids
    console.log('=== Checking products table product_id values ===');
    const { data: products } = await supabase.from('products').select('product_id, product_name, seller_account1').eq('is_deleted', false).eq('status', 'Active').limit(10);
    products?.forEach(p => console.log(`  product_id=${p.product_id} | name=${p.product_name?.substring(0,40)}`));

    // 2. Check daraz_orders items_detail for actual item_id values
    console.log('\n=== Checking daraz_orders items_detail for item_id fields ===');
    const { data: orders } = await supabase.from('daraz_orders').select('order_id, items_detail').limit(5);
    for (const order of orders || []) {
        const items = order.items_detail || [];
        if (items.length > 0) {
            const item = items[0];
            console.log(`  Order ${order.order_id}:`);
            console.log(`    item keys: ${Object.keys(item).join(', ')}`);
            console.log(`    item_id: ${item.item_id || item.ItemId || '(none)'}`);
            console.log(`    product_id: ${item.product_id || item.ProductId || '(none)'}`);
            console.log(`    sku: ${item.sku || item.Sku || item.shop_sku || '(none)'}`);
            console.log(`    name: ${item.name?.substring(0,40) || '(none)'}`);
        }
    }

    // 3. Test with actual item_id from orders (7-day window)
    console.log('\n=== Test review API with item_id from actual orders ===');
    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('app_type', 'order').maybeSingle();
    if (!tokenData) { console.log('No token'); return; }
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    const allItemIds = new Set();
    const { data: allOrders } = await supabase.from('daraz_orders').select('items_detail').limit(50);
    for (const order of allOrders || []) {
        for (const item of order.items_detail || []) {
            const pid = item.product_id || item.ProductId || item.item_id || item.ItemId;
            if (pid) allItemIds.add(String(pid));
        }
    }
    console.log(`Found ${allItemIds.size} unique item IDs from orders:`, Array.from(allItemIds).slice(0, 10));

    const now = Date.now();
    for (const itemId of Array.from(allItemIds).slice(0, 5)) {
        const params = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: now.toString(), sign_method: 'sha256',
            item_id: Number(itemId),
            start_time: now - 7 * 24 * 3600 * 1000,
            end_time: now,
            page_size: 50, current: 1
        };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        try {
            const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
            const ids = r.data.data?.id_list || [];
            console.log(`  item_id=${itemId}: code=${r.data.code} ids=${ids.length > 0 ? ids : '(none)'}`);
        } catch(e) { console.log(`  item_id=${itemId}: ERROR ${e.message}`); }
        await new Promise(r => setTimeout(r, 500));
    }

    // 4. Figure out max time window (binary search between 7 and 15)
    console.log('\n=== Finding max allowed time window ===');
    const firstItemId = Array.from(allItemIds)[0] || Number(products?.[0]?.product_id);
    for (const days of [7, 8, 9, 10, 11, 12, 13, 14]) {
        const params = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: Date.now().toString(), sign_method: 'sha256',
            item_id: Number(firstItemId),
            start_time: now - days * 24 * 3600 * 1000,
            end_time: now,
            page_size: 50, current: 1
        };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        try {
            const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
            console.log(`  ${days} days: code=${r.data.code} msg=${r.data.message || r.data.msg || '(ok)'}`);
        } catch(e) { console.log(`  ${days} days: ERROR`); }
        await new Promise(r => setTimeout(r, 400));
    }
}

run().catch(console.error);
