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

    const storeId = '1891e873-ee8d-4df4-b12e-0888ccdcd1db';
    const reviewId = '8878998320612';
    const replyContent = "Thank you so much for your review! We are thrilled to serve you.";

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle();

    if (error || !tokenData) {
        console.error('Failed to get token:', error);
        return;
    }

    const accessToken = tokenData.access_token;
    const timestamp = Date.now().toString();

    console.log('--- Testing GET request ---');
    try {
        const params = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            id: Number(reviewId),
            content: replyContent
        };
        const apiPath = '/review/seller/reply/add';
        params.sign = signRequest(apiPath, params, appSecret);

        const r = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 });
        console.log('GET Response Status:', r.status);
        console.log('GET Response Data:', r.data);
    } catch (e) {
        console.error('GET Error:', e.message);
        if (e.response) {
            console.error('GET Error Response Data:', e.response.data);
        }
    }

    console.log('\n--- Testing POST request ---');
    try {
        const params = {
            app_key: appKey,
            access_token: accessToken,
            timestamp: (Date.now() + 1000).toString(),
            sign_method: 'sha256',
            id: Number(reviewId),
            content: replyContent
        };
        const apiPath = '/review/seller/reply/add';
        params.sign = signRequest(apiPath, params, appSecret);

        const r = await axios.post(`${API_URL}${apiPath}`, null, { params, timeout: 10000 });
        console.log('POST Response Status:', r.status);
        console.log('POST Response Data:', r.data);
    } catch (e) {
        console.error('POST Error:', e.message);
        if (e.response) {
            console.error('POST Error Response Data:', e.response.data);
        }
    }
}

run().catch(console.error);
