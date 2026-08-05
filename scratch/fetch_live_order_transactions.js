const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// We require crypto and axios for signature just like in daraz-finance-service.ts
const crypto = require('crypto');
const axios = require('axios');

function signRequest(apiName, params, appSecret) {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => {
        str += key + params[key];
    });
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase();
}

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch a recent delivered order
    const { data: orders } = await supabase
        .from('daraz_orders')
        .select('*')
        .eq('order_status', 'Delivered')
        .order('order_date', { ascending: false })
        .limit(5);

    if (!orders || orders.length === 0) {
        console.log('No delivered orders found in database.');
        return;
    }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY;
    const appSecret = process.env.DARAZ_APP_SECRET;
    const apiUrl = process.env.DARAZ_API_URL || 'https://api.daraz.com.np/rest';

    for (const order of orders) {
        console.log(`Checking order ${order.order_number} (${order.order_id}) for store ${order.store_id}...`);
        
        // Fetch token
        const { data: tokenData } = await supabase
            .from('daraz_api_tokens')
            .select('*')
            .eq('store_id', order.store_id)
            .eq('app_type', 'order')
            .maybeSingle();

        if (!tokenData) {
            console.log(`No API token for store ${order.store_id}. Skipping.`);
            continue;
        }

        let startTime = new Date(order.order_date);
        startTime.setDate(startTime.getDate() - 5);
        const endTime = new Date(order.order_date);
        endTime.setDate(endTime.getDate() + 15);

        const apiPath = '/finance/transaction/details/get';
        const params = {
            app_key: appKey,
            access_token: tokenData.access_token,
            timestamp: new Date().getTime(),
            sign_method: 'sha256',
            trade_order_id: order.order_id || order.order_number,
            start_time: startTime.toISOString().split('T')[0],
            end_time: endTime.toISOString().split('T')[0],
            trans_type: -1,
            limit: 500,
            offset: 0
        };

        params.sign = signRequest(apiPath, params, appSecret);

        try {
            const response = await axios.get(`${apiUrl}${apiPath}`, { params });
            const txns = response.data?.data || [];
            console.log(`Order ${order.order_number} returned ${txns.length} live transactions.`);
            if (txns.length > 0) {
                console.log('Sample transactions:', txns.map(t => ({
                    fee_name: t.fee_name,
                    fee_type: t.fee_type,
                    transaction_type: t.transaction_type,
                    amount: t.amount
                })));
                break; // Stop after first successful fetch
            }
        } catch (err) {
            console.error(`Failed to fetch for order ${order.order_number}:`, err.message);
        }
    }
}

run();
