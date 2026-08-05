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

    // Get a store
    const { data: stores } = await supabase.from('online_stores').select('id, seller_account').limit(1);
    if (!stores || stores.length === 0) {
        console.error('No stores found in DB.');
        return;
    }

    const store = stores[0];
    console.log(`Using store: ${store.seller_account} (${store.id})`);

    // Get order token
    const { data: tokenData } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', store.id)
        .eq('app_type', 'order')
        .maybeSingle();

    if (!tokenData) {
        console.error('No order token found for store.');
        return;
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();
    const accessToken = tokenData.access_token;

    // Get active products for this store
    const { data: products } = await supabase
        .from('products')
        .select('product_id, product_name')
        .eq('is_deleted', false)
        .eq('status', 'Active');

    if (!products || products.length === 0) {
        console.error('No products found in DB.');
        return;
    }
    console.log(`Loaded ${products.length} products. Checking review history...`);

    const endTime = Date.now();
    const chunks = [
        { start: endTime - 5 * 24 * 3600 * 1000, end: endTime },
        { start: endTime - 10 * 24 * 3600 * 1000, end: endTime - 5 * 24 * 3600 * 1000 },
        { start: endTime - 15 * 24 * 3600 * 1000, end: endTime - 10 * 24 * 3600 * 1000 },
    ];

    for (const prod of products) {
        const itemId = Number(prod.product_id);
        if (isNaN(itemId)) continue;

        console.log(`Checking item: ${prod.product_name} (${itemId})...`);
        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            const timestamp = Date.now().toString();
            const params = {
                app_key: appKey,
                access_token: accessToken,
                timestamp,
                sign_method: 'sha256',
                item_id: itemId,
                start_time: Math.floor(chunk.start),
                end_time: Math.floor(chunk.end),
                page_size: 20,
                current: 1
            };

            params.sign = signRequest('/review/seller/history/list', params, appSecret);
            const response = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 5000 }).catch(e => e.response);

            if (response.data?.code === "0" || response.data?.code === 0) {
                const list = response.data.data?.id_list || [];
                if (list.length > 0) {
                    console.log(`\n🎉 Found reviews for ${prod.product_name} (${itemId}) in chunk ${idx + 1}:`, list);
                    
                    // Fetch details!
                    const listParams = {
                        app_key: appKey,
                        access_token: accessToken,
                        timestamp: Date.now().toString(),
                        sign_method: 'sha256',
                        id_list: JSON.stringify(list.map(Number))
                    };
                    const listPath = '/review/seller/list/v2';
                    listParams.sign = signRequest(listPath, listParams, appSecret);
                    const listResponse = await axios.get(`${API_URL}${listPath}`, { params: listParams, timeout: 5000 }).catch(e => e.response);
                    console.log('Reviews detail response:', JSON.stringify(listResponse.data, null, 2));
                    return; // Stop after finding first set of reviews
                }
            }
        }
    }
    console.log('Finished checking all products. No reviews found.');
}

run();
