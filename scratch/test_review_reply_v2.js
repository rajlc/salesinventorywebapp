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

    const { data: stores } = await supabase.from('online_stores').select('id, company_name, seller_account').limit(1);
    const store = stores[0];

    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();

    // Fetch a review that has comment text and reply_status != 'replied'
    const { data: reviews } = await supabase.from('daraz_reviews')
        .select('review_id, review_content')
        .eq('store_id', store.id)
        .neq('reply_status', 'replied')
        .not('review_content', 'eq', '')
        .limit(1);

    if (!reviews || reviews.length === 0) {
        console.error('No pending text reviews in database to reply to.');
        return;
    }
    
    const reviewId = Number(reviews[0].review_id);
    const replyContent = "Thank you so much for your review! We are thrilled to serve you.";
    
    console.log(`Using reviewId: ${reviewId}`);
    console.log(`Review Content: "${reviews[0].review_content}"`);

    console.log(`=== Testing review reply with GET, "id" and "content" ===`);
    try {
        const params = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: Date.now().toString(),
            sign_method: 'sha256',
            id: reviewId,
            content: replyContent
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
