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
    if (sErr) { console.error('Stores error:', sErr); return; }
    if (!stores || stores.length === 0) { console.error('No stores'); return; }
    const store = stores[0];

    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    // Use a review ID from the database
    const { data: reviews } = await supabase.from('daraz_reviews').select('review_id').eq('store_id', store.id).limit(1);
    if (!reviews || reviews.length === 0) { console.error('No reviews in database to reply to. Synchronize first.'); return; }
    
    const reviewId = Number(reviews[0].review_id);
    const replyContent = "Thank you so much for your review!";
    console.log(`Using review_id: ${reviewId}`);

    console.log(`=== Testing review reply with POST ===`);
    try {
        const params = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: Date.now().toString(),
            sign_method: 'sha256',
            review_id: reviewId,
            reply_content: replyContent
        };
        const apiPath = '/review/seller/reply/add';
        params.sign = signRequest(apiPath, params, appSecret);

        const r = await axios.post(`${API_URL}${apiPath}`, null, { params });
        console.log('POST Response:', r.data);
    } catch (e) {
        console.error('POST Error:', e.message);
    }

    console.log(`\n=== Testing review reply with GET ===`);
    try {
        const params = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: Date.now().toString(),
            sign_method: 'sha256',
            review_id: reviewId,
            reply_content: replyContent
        };
        const apiPath = '/review/seller/reply/add';
        params.sign = signRequest(apiPath, params, appSecret);

        const r = await axios.get(`${API_URL}${apiPath}`, { params });
        console.log('GET Response:', r.data);
    } catch (e) {
        console.error('GET Error:', e.message);
    }
}

run().catch(console.error);
