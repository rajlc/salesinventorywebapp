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

    const { data: stores } = await supabase.from('online_stores').select('id, seller_account').limit(1);
    const store = stores[0];
    console.log(`Store: ${store.seller_account}`);

    // Use store_id to get order token
    const { data: tokenData } = await supabase
        .from('daraz_api_tokens').select('*')
        .eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    if (!tokenData) { console.error('No order token found.'); return; }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    // Collect REAL Daraz product_id values from orders
    console.log('\n=== Collecting real Daraz item IDs from orders ===');
    const allItemIds = new Set();
    const { data: allOrders } = await supabase.from('daraz_orders').select('items_detail').limit(200);
    for (const order of allOrders || []) {
        for (const item of order.items_detail || []) {
            const pid = item.product_id || item.ProductId;
            if (pid && String(pid).length > 6) { // Real Daraz IDs are large numbers
                allItemIds.add(String(pid));
            }
        }
    }
    console.log(`Found ${allItemIds.size} unique real Daraz item IDs`);
    console.log('Sample IDs:', Array.from(allItemIds).slice(0, 10));

    // Test review API with real item IDs (7-day window)
    console.log('\n=== Testing review API with REAL Daraz item IDs (7-day window) ===');
    const now = Date.now();
    let totalFound = 0;
    const allReviewIds = new Set();
    
    for (const itemId of Array.from(allItemIds)) {
        const params = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: Date.now().toString(), sign_method: 'sha256',
            item_id: Number(itemId),
            start_time: now - 7 * 24 * 3600 * 1000,
            end_time: now,
            page_size: 50, current: 1
        };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        try {
            const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
            const ids = r.data.data?.id_list || [];
            if (ids.length > 0) {
                console.log(`  ✅ item_id=${itemId}: FOUND ${ids.length} review IDs: ${ids}`);
                ids.forEach(id => allReviewIds.add(String(id)));
                totalFound += ids.length;
            } else if (r.data.code !== '0' && r.data.code !== 0) {
                console.log(`  ⚠ item_id=${itemId}: code=${r.data.code} msg=${r.data.message || r.data.msg}`);
            }
        } catch(e) { console.log(`  ❌ item_id=${itemId}: ERROR ${e.message}`); }
        await new Promise(r => setTimeout(r, 300));
    }
    
    console.log(`\nTotal review IDs found: ${totalFound}`);

    if (allReviewIds.size > 0) {
        console.log('\n=== Fetching review details ===');
        const idArr = Array.from(allReviewIds).slice(0, 20).map(Number);
        const detailParams = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: Date.now().toString(), sign_method: 'sha256',
            id_list: JSON.stringify(idArr)
        };
        detailParams.sign = signRequest('/review/seller/list/v2', detailParams, appSecret);
        const dr = await axios.get(`${API_URL}/review/seller/list/v2`, { params: detailParams, timeout: 10000 });
        console.log('Detail response code:', dr.data.code);
        const reviewList = dr.data.data?.review_list || [];
        console.log('Reviews fetched:', reviewList.length);
        if (reviewList.length > 0) {
            console.log('First review sample:', JSON.stringify(reviewList[0], null, 2));
        }
    } else {
        // Also try chunked 7-day windows going back 60 days
        console.log('\n=== No reviews in last 7 days. Trying chunked windows (7-day each, 60 days back) ===');
        const itemIdsArr = Array.from(allItemIds).slice(0, 10); // test first 10
        for (let chunk = 0; chunk < 8; chunk++) { // 8 x 7 = 56 days
            const chunkEnd = now - chunk * 7 * 24 * 3600 * 1000;
            const chunkStart = chunkEnd - 7 * 24 * 3600 * 1000;
            console.log(`\nChunk ${chunk+1}: ${Math.floor((now-chunkEnd)/86400000)}-${Math.floor((now-chunkStart)/86400000)} days ago`);
            for (const itemId of itemIdsArr) {
                const params = {
                    app_key: appKey, access_token: tokenData.access_token,
                    timestamp: Date.now().toString(), sign_method: 'sha256',
                    item_id: Number(itemId),
                    start_time: Math.floor(chunkStart),
                    end_time: Math.floor(chunkEnd),
                    page_size: 50, current: 1
                };
                params.sign = signRequest('/review/seller/history/list', params, appSecret);
                try {
                    const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
                    const ids = r.data.data?.id_list || [];
                    if (ids.length > 0) {
                        console.log(`  ✅ item_id=${itemId}: FOUND ${ids.length} reviews: ${ids}`);
                    } else if (r.data.code !== '0' && r.data.code !== 0) {
                        console.log(`  ⚠ item_id=${itemId}: ${r.data.code} ${r.data.message || r.data.msg}`);
                    }
                } catch(e) { console.log(`  ❌ ${itemId}: ${e.message}`); }
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }
}

run().catch(console.error);
