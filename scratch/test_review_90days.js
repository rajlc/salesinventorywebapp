// Test to check how many reviews the accounts actually have over a long time period
// This tests different time windows to determine if reviews exist at all for this seller

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
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const store_id = '1891e873-ee8d-4df4-b12e-0888ccdcd1db'; // Bagmati Traders
    const { data: tokenData } = await supabase
        .from('daraz_api_tokens')
        .select('access_token')
        .eq('store_id', store_id)
        .eq('app_type', 'order')
        .maybeSingle();

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();
    const accessToken = tokenData.access_token;

    // Pick a specific product with product_id
    const { data: products } = await supabase
        .from('products')
        .select('product_id, product_name')
        .eq('is_deleted', false)
        .eq('status', 'Active')
        .limit(5);

    console.log('Testing products:', products?.map(p => `${p.product_name}(${p.product_id})`));

    // Test a very long time window broken into 7-day chunks going back 90 days
    const endTime = Date.now();
    const allIds = [];

    for (const prod of (products || []).slice(0, 2)) {
        const itemId = Number(prod.product_id);
        console.log(`\nScanning 90 days for item ${prod.product_name} (${itemId}):`);
        
        for (let daysBack = 7; daysBack <= 90; daysBack += 7) {
            const chunkEnd = endTime - (daysBack - 7) * 24 * 3600 * 1000;
            const chunkStart = endTime - daysBack * 24 * 3600 * 1000;
            
            const params = {
                app_key: appKey, access_token: accessToken,
                timestamp: Date.now().toString(), sign_method: 'sha256',
                item_id: itemId, start_time: Math.floor(chunkStart),
                end_time: Math.floor(chunkEnd), page_size: 20, current: 1
            };
            params.sign = signRequest('/review/seller/history/list', params, appSecret);
            
            try {
                const res = await axios.get(`${API_URL}/review/seller/history/list`, { params, timeout: 5000 });
                const ids = res.data.data?.id_list || [];
                if (ids.length > 0) {
                    console.log(`  ✅ Days ${daysBack-7}-${daysBack} ago: Found IDs: ${ids}`);
                    allIds.push(...ids);
                } else {
                    process.stdout.write(`.`);
                }
            } catch(e) {
                console.log(`  Error: ${e.message}`);
            }
            await new Promise(r => setTimeout(r, 800)); // Rate limiting
        }
        console.log();
    }
    
    console.log('\nTotal IDs found:', allIds.length, allIds);
}

run();
