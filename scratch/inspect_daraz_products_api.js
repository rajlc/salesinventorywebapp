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

    const { data: stores, error: sErr } = await supabase.from('online_stores').select('id, company_name, seller_account').limit(1);
    if (sErr) {
        console.error('Stores fetch error:', sErr);
        return;
    }
    if (!stores || stores.length === 0) {
        console.log('No stores found');
        return;
    }
    const store = stores[0];
    console.log(`Store: ${store.seller_account}`);

    const { data: tokenData, error: tErr } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    if (tErr) {
        console.error('Token fetch error:', tErr);
        return;
    }
    if (!tokenData) { console.error('No token found'); return; }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    const params = {
        app_key: appKey,
        access_token: tokenData.access_token,
        timestamp: Date.now().toString(),
        sign_method: 'sha256',
        filter: 'live',
        limit: 2,
        offset: 0
    };
    params.sign = signRequest('/products/get', params, appSecret);

    try {
        const res = await axios.get(`${API_URL}/products/get`, { params });
        console.log('Response code:', res.data.code);
        const products = res.data?.data?.products || [];
        console.log('Products count:', products.length);
        if (products.length > 0) {
            console.log('Sample Product:', JSON.stringify(products[0], null, 2));
        }
    } catch (e) {
        console.error('Error fetching products:', e.message);
    }
}

run();
