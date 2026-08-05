const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest';
const APP_KEY = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim() || '';
const APP_SECRET = process.env.DARAZ_APP_SECRET?.trim() || '';

function signRequest(apiName, params, appSecret = APP_SECRET) {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => { str += key + params[key]; });
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase();
}

function buildSignedParams(apiPath, accessToken, extra = {}) {
    const params = {
        app_key: APP_KEY,
        access_token: accessToken,
        timestamp: Date.now().toString(),
        sign_method: 'sha256',
        ...extra,
    };
    params.sign = signRequest(apiPath, params, APP_SECRET);
    return params;
}

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: store } = await supabase.from('online_stores').select('id').eq('is_active', true).limit(1).single();
    if (!store) {
        console.error('No active store');
        return;
    }

    const { data: token } = await supabase.from('daraz_api_tokens').select('access_token').eq('store_id', store.id).eq('app_type', 'order').single();
    if (!token) {
        console.error('No token');
        return;
    }

    const productName = 'Shoe Deodorizer and Foot Spray';
    console.log('Querying Daraz category suggestions for:', productName);

    try {
        const params = buildSignedParams('/product/category/suggestion/get', token.access_token, {
            product_name: productName,
            image_url: 'https://my-live-02.slatic.net/p/765888ef9ec9e81106f451134c94048f.jpg'
        });
        const res = await axios.get(`${API_URL}/product/category/suggestion/get`, { params });
        console.log('Daraz API response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Request failed:', err.message);
    }
}

run();
