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

    // We will try different paths
    const paths = [
        '/review/seller/list',
        '/review/seller/list/v2',
        '/review/list',
        '/review/seller/reply/add'
    ];

    for (const apiPath of paths) {
        try {
            const timestamp = Date.now().toString();
            const params = {
                app_key: appKey,
                access_token: accessToken,
                timestamp,
                sign_method: 'sha256'
            };

            // Add item_id if list API
            if (apiPath.includes('list')) {
                params.item_id = 14932; // dummy item id
            } else {
                params.review_id = 123;
                params.reply_content = 'Test';
            }

            params.sign = signRequest(apiPath, params, appSecret);

            console.log(`\nTesting API Path: ${apiPath}`);
            const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 5000 }).catch(e => e.response);

            console.log(`Status: ${response.status}`);
            console.log(`Code: ${response.data?.code}`);
            console.log(`Message: ${response.data?.message || response.data?.msg}`);
        } catch (err) {
            console.error(`Error for ${apiPath}:`, err.message);
        }
    }
}

run();
