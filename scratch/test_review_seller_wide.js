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

    // Get all stores
    const { data: stores } = await supabase.from('online_stores').select('id, seller_account');
    if (!stores || stores.length === 0) {
        console.error('No stores found in DB.');
        return;
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    for (const store of stores) {
        console.log(`\n=== Testing store: ${store.seller_account} (${store.id}) ===`);
        
        const { data: tokenData } = await supabase
            .from('daraz_api_tokens')
            .select('*')
            .eq('store_id', store.id)
            .eq('app_type', 'order')
            .maybeSingle();

        if (!tokenData) {
            console.log('  No order token. Skipping.');
            continue;
        }

        const accessToken = tokenData.access_token;
        const endTime = Date.now();
        const sevenDaysAgo = endTime - 7 * 24 * 3600 * 1000;

        // Test 1: Seller-wide (no item_id)
        console.log('\n  [Test 1] Seller-wide query (no item_id)...');
        try {
            const params = {
                app_key: appKey, access_token: accessToken,
                timestamp: Date.now().toString(), sign_method: 'sha256',
                start_time: sevenDaysAgo, end_time: endTime,
                page_size: 20, current: 1
            };
            params.sign = signRequest('/review/seller/history/list', params, appSecret);
            const res = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 8000 }).catch(e => e.response);
            console.log(`  Code: ${res.data?.code}, Msg: ${res.data?.message || res.data?.msg || 'ok'}`);
            if (res.data?.code === "0" || res.data?.code === 0) {
                const ids = res.data.data?.id_list || [];
                const total = res.data.data?.total;
                console.log(`  ✅ SUCCESS! Total: ${total}, IDs returned: ${ids.length}`, ids.slice(0, 5));
                if (ids.length > 0) {
                    // Get details
                    const p2 = {
                        app_key: appKey, access_token: accessToken,
                        timestamp: Date.now().toString(), sign_method: 'sha256',
                        id_list: JSON.stringify(ids.slice(0,3).map(Number))
                    };
                    p2.sign = signRequest('/review/seller/list/v2', p2, appSecret);
                    const r2 = await axios.get(`${API_URL}/review/seller/list/v2`, { params: p2, timeout: 8000 }).catch(e => e.response);
                    console.log('  Details response:', JSON.stringify(r2.data, null, 2));
                }
            }
        } catch(e) {
            console.log('  Error:', e.message);
        }

        await new Promise(r => setTimeout(r, 1000));
    }
    console.log('\nDone.');
}

run();
