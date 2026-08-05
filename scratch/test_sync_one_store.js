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

    // Get "Cosmetic Shop" store
    const { data: stores } = await supabase.from('online_stores').select('id, seller_account').eq('seller_account', 'Cosmetic Shop').limit(1);
    if (!stores || stores.length === 0) {
        console.error('Store not found.');
        return;
    }
    const store = stores[0];
    console.log(`Store: ${store.seller_account} (${store.id})`);

    const { data: tokenData } = await supabase.from('daraz_api_tokens').select('*').eq('store_id', store.id).eq('app_type', 'order').maybeSingle();
    if (!tokenData) { console.error('No token found'); return; }

    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim();
    const appSecret = process.env.DARAZ_APP_SECRET?.trim();
    const accessToken = tokenData.access_token;

    console.log(`[ReviewSync] Fetching live products from Daraz API to extract real item IDs...`);
    const productDetailsMap = new Map();
    try {
        const limit = 50;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const params = {
                app_key: appKey,
                access_token: accessToken,
                timestamp: Date.now().toString(),
                sign_method: 'sha256',
                filter: 'live',
                limit,
                offset
            };
            const apiPath = '/products/get';
            params.sign = signRequest(apiPath, params, appSecret);
            
            console.log(`[ReviewSync] Fetching live products page (offset=${offset})...`);
            const res = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 });
            if (res.data.code === '0' || res.data.code === 0) {
                const products = res.data?.data?.products || [];
                for (const p of products) {
                    const itemId = String(p.item_id);
                    const name = p.attributes?.name || '';
                    const image = p.images?.[0] || '';
                    const skus = (p.skus || []).map(s => s.SellerSku).filter(Boolean);
                    productDetailsMap.set(itemId, { name, image, skus });
                }
                if (products.length < limit) {
                    hasMore = false;
                } else {
                    offset += limit;
                }
            } else {
                console.error(`[ReviewSync] Failed to fetch products from Daraz API: ${res.data.message || res.data.msg}`);
                hasMore = false;
            }
            await new Promise(r => setTimeout(r, 100));
        }
    } catch (err) {
        console.error(`[ReviewSync] Error loading store products from Daraz API:`, err.message);
    }

    const orderItemIds = new Set();
    try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const { data: recentOrders } = await supabase
            .from('daraz_orders')
            .select('items_detail')
            .eq('store_id', store.id)
            .gte('order_date', ninetyDaysAgo.toISOString().split('T')[0]);

        for (const order of recentOrders || []) {
            for (const item of order.items_detail || []) {
                const pid = item.product_id || item.ProductId;
                if (pid && String(pid).length > 6) {
                    orderItemIds.add(String(pid));
                }
            }
        }
        console.log(`[ReviewSync] Found ${orderItemIds.size} unique product IDs in orders from last 90 days.`);
    } catch (err) {
        console.error(`[ReviewSync] Error loading product IDs from orders:`, err.message);
    }

    for (const pid of orderItemIds) {
        if (!productDetailsMap.has(pid)) {
            productDetailsMap.set(pid, { name: 'Product', image: '', skus: [] });
        }
    }

    const activeProductIds = Array.from(productDetailsMap.keys()).map(Number);
    console.log(`[ReviewSync] Scanning reviews for ${activeProductIds.length} unique Daraz product IDs.`);

    const allReviewIds = new Set();
    const itemIdMap = new Map();
    
    // Test 14 days lookback (2 chunks)
    const chunks = [];
    const now = Date.now();
    const chunkSizeMs = 7 * 24 * 3600 * 1000;
    const daysLookback = 14;

    const numChunks = Math.ceil(daysLookback / 7);
    for (let i = 0; i < numChunks; i++) {
        const chunkEnd = now - i * chunkSizeMs;
        const chunkStart = Math.max(now - (i + 1) * chunkSizeMs, now - daysLookback * 24 * 3600 * 1000);
        chunks.push({ start: Math.floor(chunkStart), end: Math.floor(chunkEnd) });
    }

    const batchSize = 5;
    const delayMs = 800;
    
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        console.log(`[ReviewSync] Scanning chunk ${chunkIdx + 1}/${chunks.length} (${Math.floor((now - chunk.end) / 86400000)}-${Math.floor((now - chunk.start) / 86400000)} days ago)...`);
        
        for (let i = 0; i < activeProductIds.length; i += batchSize) {
            const batch = activeProductIds.slice(i, i + batchSize);
            await Promise.all(batch.map(async (itemId) => {
                try {
                    const params = {
                        app_key: appKey,
                        access_token: accessToken,
                        timestamp: Date.now().toString(),
                        sign_method: 'sha256',
                        item_id: itemId,
                        start_time: chunk.start,
                        end_time: chunk.end,
                        page_size: 50,
                        current: 1
                    };

                    const apiPath = '/review/seller/history/list';
                    params.sign = signRequest(apiPath, params, appSecret);

                    const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 });

                    if (response.data.code === "0" || response.data.code === 0) {
                        const idList = response.data.data?.id_list || [];
                        if (idList.length > 0) {
                            console.log(`  ✅ item_id=${itemId}: FOUND ${idList.length} reviews`);
                        }
                        for (const rId of idList) {
                            const strId = String(rId);
                            allReviewIds.add(strId);
                            itemIdMap.set(strId, String(itemId));
                        }
                    } else {
                        const msg = response.data.message || response.data.msg || '';
                        if (!msg.includes('frequency') && !msg.includes('limit')) {
                            console.warn(`  ⚠ item_id=${itemId}: warning ${msg}`);
                        }
                    }
                } catch (itemErr) {
                    console.error(`  ❌ item_id=${itemId}: error`, itemErr.message);
                }
            }));
            
            if (i + batchSize < activeProductIds.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    const reviewIdsArray = Array.from(allReviewIds);
    console.log(`\n[ReviewSync] Found a total of ${reviewIdsArray.length} review IDs.`);

    if (reviewIdsArray.length > 0) {
        console.log(`Retrieving details for reviews...`);
        const detailBatchSize = 20;
        for (let j = 0; j < reviewIdsArray.length; j += detailBatchSize) {
            const batchIds = reviewIdsArray.slice(j, j + detailBatchSize);
            const params = {
                app_key: appKey,
                access_token: accessToken,
                timestamp: Date.now().toString(),
                sign_method: 'sha256',
                id_list: JSON.stringify(batchIds.map(Number))
            };
            const apiPath = '/review/seller/list/v2';
            params.sign = signRequest(apiPath, params, appSecret);

            const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 });
            console.log('API response code:', response.data.code);
            const reviewList = response.data.data?.review_list || [];
            console.log(`Fetched details for ${reviewList.length} reviews.`);
            
            for (const item of reviewList) {
                const reviewId = String(item.id || item.review_id);
                const orderId = item.order_id ? String(item.order_id) : null;
                const rating = item.ratings?.product_rating ? Number(item.ratings.product_rating) : 5;
                const reviewContent = item.review_content || '';
                const replyContent = item.seller_reply || null;
                const initialReplyStatus = replyContent ? 'replied' : 'pending';
                const finalTimeNum = item.create_time || item.submit_time || Date.now();
                const createdAt = new Date(Number(finalTimeNum)).toISOString();
                const itemId = item.product_id ? String(item.product_id) : (item.item_id ? String(item.item_id) : itemIdMap.get(reviewId) || '');

                let buyerName = 'Buyer';
                if (orderId) {
                    const { data: orderData } = await supabase
                        .from('daraz_orders')
                        .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                        .eq('order_id', orderId)
                        .maybeSingle();
                    if (orderData) {
                        buyerName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name} ${orderData.customer_last_name}`.trim() || 'Buyer';
                    }
                }

                let productName = 'Product';
                let productImage = null;

                const darazProd = productDetailsMap.get(itemId);
                if (darazProd && darazProd.name) {
                    productName = darazProd.name;
                    productImage = darazProd.image || null;
                } else if (orderId) {
                    const { data: orderData } = await supabase
                        .from('daraz_orders')
                        .select('items_detail')
                        .eq('order_id', orderId)
                        .maybeSingle();
                    if (orderData && orderData.items_detail) {
                        const matchedItem = orderData.items_detail.find(it => String(it.product_id || it.ProductId) === itemId);
                        if (matchedItem) {
                            productName = matchedItem.name || 'Product';
                            productImage = matchedItem.product_main_image || null;
                        }
                    }
                }

                console.log(`Upserting review ${reviewId}:`);
                console.log(`  Product: ${productName}`);
                console.log(`  Buyer: ${buyerName}`);
                console.log(`  Rating: ${rating}`);
                console.log(`  Content: ${reviewContent}`);

                const upsertPayload = {
                    review_id: reviewId,
                    store_id: store.id,
                    order_id: orderId,
                    item_id: String(itemId),
                    product_name: productName,
                    product_image: productImage,
                    rating,
                    review_content: reviewContent,
                    buyer_name: buyerName,
                    reply_content: replyContent,
                    reply_status: initialReplyStatus,
                    created_at: createdAt,
                    synced_at: new Date().toISOString()
                };

                const { error: upsertErr } = await supabase
                    .from('daraz_reviews')
                    .upsert(upsertPayload, { onConflict: 'review_id' });
                if (upsertErr) {
                    console.error('  Upsert error:', upsertErr.message);
                } else {
                    console.log('  ✅ Upsert success');
                }
            }
        }
    }
}

run().catch(console.error);
