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

    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    const realItemId = 145902665; // A product we know exists and has reviews
    const now = Date.now();

    console.log(`=== Testing Time Window with REAL item_id = ${realItemId} ===`);
    for (const days of [7, 8, 9, 10, 11, 12, 13, 14, 15, 30]) {
        const params = {
            app_key: appKey, access_token: tokenData.access_token,
            timestamp: Date.now().toString(), sign_method: 'sha256',
            item_id: realItemId,
            start_time: now - days * 24 * 3600 * 1000,
            end_time: now,
            page_size: 20, current: 1
        };
        params.sign = signRequest('/review/seller/history/list', params, appSecret);
        try {
            const r = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 10000 });
            console.log(`  ${days} days: code=${r.data.code} msg=${r.data.message || r.data.msg || '(ok)'} ids=${r.data.data?.id_list?.length || 0}`);
        } catch (e) {
            console.log(`  ${days} days: ERROR ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 400));
    }
}

run().catch(console.error);
