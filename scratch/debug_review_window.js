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

async function testWindow(appKey, appSecret, accessToken, itemId, daysBack) {
    const now = Date.now();
    const params = {
        app_key: appKey, access_token: accessToken,
        timestamp: now.toString(), sign_method: 'sha256',
        item_id: itemId,
        start_time: now - daysBack * 24 * 3600 * 1000,
        end_time: now,
        page_size: 20, current: 1
    };
    params.sign = signRequest('/review/seller/history/list', params, appSecret);
    const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 15000 });
    return { code: r.data.code, msg: r.data.message || r.data.msg || '', ids: r.data.data?.id_list || [] };
}

async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: stores } = await supabase.from('online_stores').select('id, seller_account').limit(1);
    const store = stores[0];

    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();
    const { data: products } = await supabase.from('products').select('product_id, product_name').eq('is_deleted', false).eq('status', 'Active').limit(1);
    const itemId = Number(products[0].product_id);

    console.log(`Testing time window limits with item: ${products[0].product_name} (${itemId})`);
    for (const days of [7, 15, 30, 45, 60]) {
        const result = await testWindow(appKey, appSecret, tokenData.access_token, itemId, days);
        console.log(`  ${days} days: code=${result.code} msg=${result.msg || '(ok)'} ids=${result.ids.length}`);
        await new Promise(r => setTimeout(r, 500));
    }

    // Now test chunked 5-day windows across 90 days total
    console.log('\n=== Chunked 5-day windows across 90 days for first 3 products ===');
    const allProducts = await supabase.from('products').select('product_id, product_name').eq('is_deleted', false).eq('status', 'Active').limit(3);
    
    const now = Date.now();
    const chunks = [];
    for (let i = 0; i < 18; i++) { // 18 * 5 = 90 days
        chunks.push({ start: now - (i+1) * 5 * 24 * 3600 * 1000, end: now - i * 5 * 24 * 3600 * 1000 });
    }

    const foundIds = new Set();
    for (const prod of allProducts.data || []) {
        const pId = Number(prod.product_id);
        if (isNaN(pId)) continue;
        console.log(`\nProduct: ${prod.product_name} (${pId})`);
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const params = {
                app_key: appKey, access_token: tokenData.access_token,
                timestamp: Date.now().toString(), sign_method: 'sha256',
                item_id: pId,
                start_time: Math.floor(chunk.start),
                end_time: Math.floor(chunk.end),
                page_size: 50, current: 1
            };
            params.sign = signRequest('/review/seller/history/list', params, appSecret);
            try {
                const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
                const ids = r.data.data?.id_list || [];
                if (r.data.code === '0' || r.data.code === 0) {
                    if (ids.length > 0) {
                        console.log(`  Chunk ${i+1} (${Math.floor((now - chunk.end)/86400000)}-${Math.floor((now - chunk.start)/86400000)} days ago): FOUND ${ids.length} reviews: ${ids}`);
                        ids.forEach(id => foundIds.add(String(id)));
                    }
                } else {
                    console.log(`  Chunk ${i+1}: error code=${r.data.code} msg=${r.data.message || r.data.msg}`);
                }
            } catch(e) { console.log(`  Chunk ${i+1}: exception: ${e.message}`); }
            await new Promise(r => setTimeout(r, 300));
        }
    }
    console.log(`\nTotal unique review IDs found across 90 days: ${foundIds.size}`);
    if (foundIds.size > 0) {
        console.log('IDs:', Array.from(foundIds));
        // Fetch review details
        const idArr = Array.from(foundIds).map(Number);
        const detailParams = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: Date.now().toString(), sign_method: 'sha256',
            id_list: JSON.stringify(idArr)
        };
        detailParams.sign = signRequest('/review/seller/list/v2', detailParams, appSecret);
        const dr = await axios.get(`${API_URL}/review/seller/list/v2`, { params: detailParams, timeout: 10000 });
        console.log('\nDetail response:', JSON.stringify(dr.data, null, 2));
    }
}

run().catch(console.error);
