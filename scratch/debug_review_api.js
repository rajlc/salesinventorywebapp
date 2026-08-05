const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest';

function signRequest(apiName, params, appSecret) {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => {
        str += key + String(params[key]);
    });
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase();
}

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: stores } = await supabase.from('online_stores').select('id, seller_account').limit(1);
    if (!stores || stores.length === 0) { console.error('No stores found.'); return; }
    const store = stores[0];
    console.log(`Store: ${store.seller_account} (${store.id})`);

    const { data: tokenData } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', store.id)
        .eq('app_type', 'order')
        .maybeSingle();

    if (!tokenData) { console.error('No order token found.'); return; }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();
    const accessToken = tokenData.access_token;

    console.log(`\n=== TEST 1: Seller-wide fetch (no item_id, no time filter) ===`);
    try {
        const ts = Date.now().toString();
        const params = { app_key: appKey, access_token: accessToken, timestamp: ts, sign_method: 'sha256', page_size: 10, current: 1 };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 15000 });
        console.log('Response code:', r.data.code);
        console.log('Response message:', r.data.message || r.data.msg || '(none)');
        console.log('Response data:', JSON.stringify(r.data.data, null, 2));
    } catch(e) { console.error('Error:', e.message); }

    console.log(`\n=== TEST 2: Seller-wide fetch with 90-day window ===`);
    try {
        const now = Date.now();
        const ts = now.toString();
        const params = {
            app_key: appKey, access_token: accessToken, timestamp: ts, sign_method: 'sha256',
            start_time: now - 90 * 24 * 3600 * 1000,
            end_time: now,
            page_size: 10, current: 1
        };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 15000 });
        console.log('Response code:', r.data.code);
        console.log('Response message:', r.data.message || r.data.msg || '(none)');
        console.log('Response data:', JSON.stringify(r.data.data, null, 2));
    } catch(e) { console.error('Error:', e.message); }

    // Get a few product IDs
    const { data: products } = await supabase.from('products').select('product_id, product_name').eq('is_deleted', false).eq('status', 'Active').limit(5);
    if (!products || products.length === 0) { console.log('No products found'); return; }

    console.log(`\n=== TEST 3: Per-product fetch on first 5 products (90-day window, verbose) ===`);
    for (const prod of products) {
        const itemId = Number(prod.product_id);
        if (isNaN(itemId)) continue;
        console.log(`\nItem: ${prod.product_name} (ID: ${itemId})`);
        try {
            const now = Date.now();
            const ts = now.toString();
            const params = {
                app_key: appKey, access_token: accessToken, timestamp: ts, sign_method: 'sha256',
                item_id: itemId,
                start_time: now - 90 * 24 * 3600 * 1000,
                end_time: now,
                page_size: 20, current: 1
            };
            params.sign = signRequest('/review/seller/history/list', params, appSecret);
            const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 15000 });
            console.log('  code:', r.data.code, '| msg:', r.data.message || r.data.msg || '');
            const ids = r.data.data?.id_list || [];
            console.log('  review IDs found:', ids.length > 0 ? ids : '(none)');
        } catch(e) { console.error('  Error:', e.message); }
    }

    console.log(`\n=== TEST 4: Direct list v2 fetch (get all reviews without ID list) ===`);
    try {
        const now = Date.now();
        const ts = now.toString();
        const params = { app_key: appKey, access_token: accessToken, timestamp: ts, sign_method: 'sha256', page_size: 10, current: 1 };
        params.sign = signRequest('/review/seller/list/v2', params, appSecret);
        const r = await axios.get(`${API_URL}/review/seller/list/v2`, { params, timeout: 15000 });
        console.log('Response code:', r.data.code);
        console.log('Response message:', r.data.message || r.data.msg || '(none)');
        console.log('Response data keys:', r.data.data ? Object.keys(r.data.data) : 'null');
        const reviewList = r.data.data?.review_list || [];
        console.log('Reviews count:', reviewList.length);
        if (reviewList.length > 0) {
            console.log('First review sample:', JSON.stringify(reviewList[0], null, 2));
        }
    } catch(e) { console.error('Error:', e.message); }

    console.log(`\n=== TEST 5: Check /review/seller/list (v1, no filter) ===`);
    try {
        const ts = Date.now().toString();
        const params = { app_key: appKey, access_token: accessToken, timestamp: ts, sign_method: 'sha256', page_size: 10, current: 1 };
        params.sign = signRequest('/review/seller/list', params, appSecret);
        const r = await axios.get(`${API_URL}/review/seller/list`, { params, timeout: 15000 });
        console.log('Response code:', r.data.code);
        console.log('Response message:', r.data.message || r.data.msg || '(none)');
        console.log('Response data:', JSON.stringify(r.data.data, null, 2));
    } catch(e) { console.error('Error:', e.message); }
}

run().catch(console.error);
