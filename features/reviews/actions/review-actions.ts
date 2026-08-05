'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import axios from 'axios'

export interface ReviewSettings {
    store_id: string
    ai_reply_enabled: boolean
    cutoff_time: string | null
    ai_instruction: string | null
    ai_provider: string
    openai_api_key: string | null
    openai_model: string
    positive_keywords: string[]
    positive_templates: string[]
    neutral_keywords: string[]
    neutral_templates: string[]
    negative_keywords: string[]
    negative_templates: string[]
    created_at?: string
    updated_at?: string
}

const API_URL = process.env.DARAZ_API_URL?.trim() || 'https://api.daraz.com.np/rest'

// Helper: Sign Daraz API Requests
function signRequest(apiName: string, params: Record<string, unknown>, appSecret: string) {
    const keys = Object.keys(params).sort()
    let str = apiName
    keys.forEach(key => {
        str += key + String(params[key])
    })
    return crypto.createHmac('sha256', appSecret).update(str).digest('hex').toUpperCase()
}

// 1. Get Store Tokens & App Config (using order app keys)
async function getStoreTokenAndSecret(storeId: string) {
    const appKey = process.env.NEXT_PUBLIC_DARAZ_APP_KEY?.trim()
    const appSecret = process.env.DARAZ_APP_SECRET?.trim()

    if (!appKey || !appSecret) {
        throw new Error('Daraz API keys configuration missing on server env')
    }

    const supabase = await createAdminClient()
    const { data: tokenData, error } = await supabase
        .from('daraz_api_tokens')
        .select('*')
        .eq('store_id', storeId)
        .eq('app_type', 'order')
        .maybeSingle()

    if (error || !tokenData) {
        throw new Error(`No active order connection or token found for store: ${storeId}. Please connect your Daraz account.`)
    }

    return { appKey, appSecret, accessToken: tokenData.access_token }
}

// 2. Retrieve Review Settings
export async function getReviewSettings(storeId: string): Promise<ReviewSettings> {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('daraz_review_settings')
        .select('*')
        .eq('store_id', storeId)
        .maybeSingle()

    if (error) {
        console.error('[ReviewSettings] Error fetching settings:', error.message)
    }

    if (data) {
        return data as ReviewSettings
    }

    // Default settings
    const defaultSettings: ReviewSettings = {
        store_id: storeId,
        ai_reply_enabled: false,
        cutoff_time: null,
        ai_instruction: 'Please thank the customer for their review. Respond politely and concisely in the customer\'s language.',
        ai_provider: 'gemini',
        openai_api_key: null,
        openai_model: 'gpt-4o-mini',
        positive_keywords: ['good', 'ramro xa', 'man paryo', 'great', 'nice', 'excellent', 'love', 'perfect', 'satisfied', 'happy', 'best', 'sweet'],
        positive_templates: ['Thank you so much for the review! We are thrilled to serve you.'],
        neutral_keywords: ['okay', 'thik thikai', 'average', 'medium', 'fair'],
        neutral_templates: ['Thank you for your honest feedback. We will work to make it better.'],
        negative_keywords: ['bad', 'poor', 'damage', 'broke', 'fake', 'late', 'worst', 'defect', 'waste', 'cheat', 'delay', 'slow', 'wrong'],
        negative_templates: ['We are extremely sorry for the bad experience. We will investigate and improve this.']
    }

    // Insert defaults if not found
    const { data: inserted, error: insErr } = await supabase
        .from('daraz_review_settings')
        .insert(defaultSettings)
        .select()
        .single()

    if (insErr) {
        console.error('[ReviewSettings] Error creating default settings:', insErr.message)
        return defaultSettings
    }

    return inserted as ReviewSettings
}

// 3. Update Review Settings
export async function updateReviewSettings(storeId: string, settings: Partial<ReviewSettings>) {
    try {
        const supabase = await createAdminClient()
        const payload = {
            ...settings,
            updated_at: new Date().toISOString()
        }

        const { error } = await supabase
            .from('daraz_review_settings')
            .update(payload)
            .eq('store_id', storeId)

        if (error) throw error

        revalidatePath('/dashboard/chat-ai')
        revalidatePath('/dashboard/chat-ai/reviews')
        return { success: true }
    } catch (err: any) {
        console.error('[ReviewSettings] Update failed:', err.message)
        return { success: false, error: err.message }
    }
}

// Helper: Call Gemini API for Review Reply
async function generateAiReviewReply(
    rating: number,
    reviewContent: string,
    storeName: string,
    settings: ReviewSettings
): Promise<string | null> {
    const isOpenAi = settings.ai_provider === 'openai'
    const apiKey = isOpenAi 
        ? settings.openai_api_key 
        : (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)

    if (!apiKey) {
        console.warn(`[ReviewAutoReply] API key for provider ${settings.ai_provider || 'gemini'} is missing.`)
        return null
    }

    const templateInfo = `Keyword-based Templates context:
- Positive templates: ${JSON.stringify(settings.positive_templates)}
- Neutral templates: ${JSON.stringify(settings.neutral_templates)}
- Negative templates: ${JSON.stringify(settings.negative_templates)}`

    const systemPrompt = `You are an automated AI Customer Service Assistant for our store "${storeName}" on Daraz.
We received a product review from a customer. Your job is to generate a polite, concise, and helpful reply to this review.

Review Details:
- Rating: ${rating} Star(s)
- Customer Comment: "${reviewContent}"

AI Instructions / Guidelines:
${settings.ai_instruction || 'Please thank the customer and respond appropriately.'}

Template Inspiration:
${templateInfo}

Please generate a reply that fits the rating and comment. If customer didn't leave a comment, output a customized thank you or appropriate response based on the template inspiration. Keep the reply short (1-2 sentences) and polite. Do not include prefixes like "Response:" or "Reply:". Just output the clean reply text.
Reply:`

    try {
        if (isOpenAi) {
            console.log(`[ReviewAutoReply] Calling OpenAI API (${settings.openai_model || 'gpt-4o-mini'})...`)
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: settings.openai_model || 'gpt-4o-mini',
                    messages: [
                        { role: 'user', content: systemPrompt }
                    ],
                    max_tokens: 150,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    timeout: 10000
                }
            )
            const replyText = response.data?.choices?.[0]?.message?.content
            return replyText ? replyText.trim() : null
        } else {
            console.log('[ReviewAutoReply] Calling Gemini API...')
            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                    contents: [{
                        parts: [{ text: systemPrompt }]
                    }]
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            )
            const replyText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
            return replyText ? replyText.trim() : null
        }
    } catch (err: any) {
        console.error(`[ReviewAutoReply] AI API call failed (${settings.ai_provider}):`, err.message)
        return null
    }
}

// 3.5 Generate Single Review Suggestion On-Demand
export async function generateSingleReviewSuggestion(storeId: string, reviewId: string) {
    try {
        const supabase = await createAdminClient()
        
        // Fetch review details
        const { data: review, error: revErr } = await supabase
            .from('daraz_reviews')
            .select('*')
            .eq('review_id', reviewId)
            .single()

        if (revErr || !review) {
            throw new Error(`Review not found: ${reviewId}`)
        }

        // Fetch store settings
        const settings = await getReviewSettings(storeId)

        // Fetch store info
        const { data: store, error: storeErr } = await supabase
            .from('online_stores')
            .select('seller_account')
            .eq('id', storeId)
            .single()

        if (storeErr || !store) {
            throw new Error(`Store not found: ${storeId}`)
        }

        const reviewContent = review.review_content || ''
        const rating = review.rating

        console.log(`[ReviewSuggestion] Manually generating suggestion for review ${reviewId}...`)
        const aiReply = await generateAiReviewReply(rating, reviewContent, store.seller_account, settings)

        if (aiReply && aiReply.trim()) {
            const cleanReply = aiReply.trim()
            // Update review in DB
            const { error: updErr } = await supabase
                .from('daraz_reviews')
                .update({
                    suggested_reply: cleanReply,
                    suggested_reply_source: 'ai'
                })
                .eq('review_id', reviewId)

            if (updErr) throw updErr

            revalidatePath('/dashboard/chat-ai/reviews')
            return { success: true, suggested_reply: cleanReply }
        } else {
            throw new Error('AI failed to generate a suggestion.')
        }
    } catch (err: any) {
        console.error(`[ReviewSuggestion] Manual generation failed for review ${reviewId}:`, err.message)
        return { success: false, error: err.message }
    }
}

// 4. Post Reply to Daraz Review
export async function replyToReview(storeId: string, reviewId: string, replyContent: string) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        const timestamp = Date.now().toString()
        const params: Record<string, unknown> = {
            app_key: appKey,
            access_token: accessToken,
            timestamp,
            sign_method: 'sha256',
            id: Number(reviewId),
            content: replyContent
        }

        const apiPath = '/review/seller/reply/add'
        params.sign = signRequest(apiPath, params, appSecret)

        console.log(`[ReviewReply] Submitting reply for review ${reviewId}...`)
        const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

        if (response.data.code !== "0" && response.data.code !== 0) {
            throw new Error(`Daraz API Error: ${response.data.message || response.data.msg}`)
        }

        // Update local database status
        const { error } = await supabase
            .from('daraz_reviews')
            .update({
                reply_content: replyContent,
                reply_status: 'replied',
                replied_at: new Date().toISOString()
            })
            .eq('review_id', reviewId)

        if (error) {
            console.error(`[ReviewReply] Failed to update local review ${reviewId}:`, error.message)
        }

        return { success: true }
    } catch (err: any) {
        console.error(`[ReviewReply] Reply failed for review ${reviewId}:`, err.message)
        
        // Update local database status to failed
        const supabase = await createAdminClient()
        await supabase
            .from('daraz_reviews')
            .update({
                reply_status: 'failed'
            })
            .eq('review_id', reviewId)

        return { success: false, error: err.message }
    }
}

// 5. Bulk Reply to Reviews
export async function bulkReplyToReviews(storeId: string, reviewIds: string[], replyContent: string) {
    try {
        console.log(`[ReviewBulkReply] Starting bulk reply for ${reviewIds.length} reviews...`)
        const results = []
        for (const reviewId of reviewIds) {
            const res = await replyToReview(storeId, reviewId, replyContent)
            results.push({ reviewId, ...res })
        }
        revalidatePath('/dashboard/chat-ai/reviews')
        return { success: true, results }
    } catch (err: any) {
        console.error('[ReviewBulkReply] Bulk reply process failed:', err.message)
        return { success: false, error: err.message }
    }
}

// 6. Sync Reviews from Daraz API for all active products
export async function syncDarazReviews(storeId: string, daysLookback: number = 14) {
    try {
        const { appKey, appSecret, accessToken } = await getStoreTokenAndSecret(storeId)
        const supabase = await createAdminClient()

        // Get store details
        const { data: store, error: storeErr } = await supabase
            .from('online_stores')
            .select('*')
            .eq('id', storeId)
            .single()

        if (storeErr || !store) {
            throw new Error(`Store not found: ${storeId}`)
        }

        console.log(`[ReviewSync] Fetching live products from Daraz API to extract real item IDs...`)

        // Fetch all active products from Daraz API for this store
        const productDetailsMap = new Map<string, { name: string; image: string; skus: string[] }>()
        try {
            const limit = 50
            let offset = 0
            let hasMore = true
            while (hasMore) {
                const params: Record<string, any> = {
                    app_key: appKey,
                    access_token: accessToken,
                    timestamp: Date.now().toString(),
                    sign_method: 'sha256',
                    filter: 'live',
                    limit,
                    offset
                }
                const apiPath = '/products/get'
                params.sign = signRequest(apiPath, params, appSecret)
                
                console.log(`[ReviewSync] Fetching live products page (offset=${offset})...`)
                const res = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })
                if (res.data.code === '0' || res.data.code === 0) {
                    const products = res.data?.data?.products || []
                    for (const p of products) {
                        const itemId = String(p.item_id)
                        const name = p.attributes?.name || ''
                        const image = p.images?.[0] || ''
                        const skus = (p.skus || []).map((s: any) => s.SellerSku).filter(Boolean)
                        productDetailsMap.set(itemId, { name, image, skus })
                    }
                    if (products.length < limit) {
                        hasMore = false
                    } else {
                        offset += limit
                    }
                } else {
                    console.error(`[ReviewSync] Failed to fetch products from Daraz API: ${res.data.message || res.data.msg}`)
                    hasMore = false
                }
                await new Promise(r => setTimeout(r, 100))
            }
        } catch (err: any) {
            console.error(`[ReviewSync] Error loading store products from Daraz API:`, err.message)
        }

        // Fetch unique product IDs from orders in the last 90 days as backup/supplement
        const orderItemIds = new Set<string>()
        try {
            const ninetyDaysAgo = new Date()
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
            
            const { data: recentOrders } = await supabase
                .from('daraz_orders')
                .select('items_detail')
                .eq('store_id', storeId)
                .gte('order_date', ninetyDaysAgo.toISOString().split('T')[0])

            for (const order of recentOrders || []) {
                for (const item of order.items_detail || []) {
                    const pid = item.product_id || item.ProductId
                    if (pid && String(pid).length > 6) {
                        orderItemIds.add(String(pid))
                    }
                }
            }
            console.log(`[ReviewSync] Found ${orderItemIds.size} unique product IDs in orders from last 90 days.`)
        } catch (err: any) {
            console.error(`[ReviewSync] Error loading product IDs from orders:`, err.message)
        }

        // Merge order-based IDs into our details map if not already present
        for (const pid of orderItemIds) {
            if (!productDetailsMap.has(pid)) {
                productDetailsMap.set(pid, { name: 'Product', image: '', skus: [] })
            }
        }

        const activeProductIds = Array.from(productDetailsMap.keys()).map(Number)
        console.log(`[ReviewSync] Scanning reviews for ${activeProductIds.length} unique Daraz product IDs.`)

        // Fetch review settings
        const settings = await getReviewSettings(storeId)
        let reviewsSyncedCount = 0

        // Step A: Fetch review IDs in chunked 7-day windows
        const allReviewIds = new Set<string>()
        const itemIdMap = new Map<string, string>() // maps review_id -> item_id
        
        const chunks: Array<{ start: number; end: number }> = []
        const now = Date.now()
        const chunkSizeMs = 7 * 24 * 3600 * 1000 // 7 days

        const numChunks = Math.ceil(daysLookback / 7)
        for (let i = 0; i < numChunks; i++) {
            const chunkEnd = now - i * chunkSizeMs
            const chunkStart = Math.max(now - (i + 1) * chunkSizeMs, now - daysLookback * 24 * 3600 * 1000)
            chunks.push({ start: Math.floor(chunkStart), end: Math.floor(chunkEnd) })
        }

        const batchSize = 5  // Max 5 concurrent requests to avoid rate limiting
        const delayMs = 800  // Delay in milliseconds between batches
        
        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            const chunk = chunks[chunkIdx]
            console.log(`[ReviewSync] Scanning chunk ${chunkIdx + 1}/${chunks.length} (${Math.floor((now - chunk.end) / 86400000)}-${Math.floor((now - chunk.start) / 86400000)} days ago)...`)
            
            for (let i = 0; i < activeProductIds.length; i += batchSize) {
                const batch = activeProductIds.slice(i, i + batchSize)
                await Promise.all(batch.map(async (itemId) => {
                    try {
                        const params: Record<string, unknown> = {
                            app_key: appKey,
                            access_token: accessToken,
                            timestamp: Date.now().toString(),
                            sign_method: 'sha256',
                            item_id: itemId,
                            start_time: chunk.start,
                            end_time: chunk.end,
                            page_size: 50,
                            current: 1
                        }

                        const apiPath = '/review/seller/history/list'
                        params.sign = signRequest(apiPath, params, appSecret)

                        const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

                        if (response.data.code === "0" || response.data.code === 0) {
                            const idList = response.data.data?.id_list || []
                            for (const rId of idList) {
                                const strId = String(rId)
                                allReviewIds.add(strId)
                                itemIdMap.set(strId, String(itemId))
                            }
                        } else {
                            const msg = response.data.message || response.data.msg || ''
                            // Only log non-rate-limit warnings to avoid log spam
                            if (!msg.includes('frequency') && !msg.includes('limit')) {
                                console.warn(`[ReviewSync] History API warning for item ${itemId}: ${msg}`)
                            }
                        }
                    } catch (itemErr: any) {
                        console.error(`[ReviewSync] Error calling history API for item ${itemId}:`, itemErr.message)
                    }
                }))
                
                if (i + batchSize < activeProductIds.length) {
                    await new Promise(resolve => setTimeout(resolve, delayMs))
                }
            }
        }

        const reviewIdsArray = Array.from(allReviewIds)
        console.log(`[ReviewSync] Found a total of ${reviewIdsArray.length} review IDs. Retrieving details...`)

        // Step B: Batch query /review/seller/list/v2 to fetch full review contents
        const detailBatchSize = 20
        for (let j = 0; j < reviewIdsArray.length; j += detailBatchSize) {
            const batchIds = reviewIdsArray.slice(j, j + detailBatchSize)
            try {
                const timestamp = Date.now().toString()
                const params: Record<string, unknown> = {
                    app_key: appKey,
                    access_token: accessToken,
                    timestamp,
                    sign_method: 'sha256',
                    id_list: JSON.stringify(batchIds.map(Number))
                }

                const apiPath = '/review/seller/list/v2'
                params.sign = signRequest(apiPath, params, appSecret)

                console.log(`[ReviewSync] Fetching details for review batch [${batchIds.join(', ')}]...`)
                const response = await axios.get(`${API_URL}${apiPath}`, { params, timeout: 10000 })

                if (response.data.code !== "0" && response.data.code !== 0) {
                    console.warn(`[ReviewSync] Details API warning for batch: ${response.data.message || response.data.msg}`)
                    continue
                }

                const reviewList = response.data.data?.review_list || []
                
                for (const item of reviewList) {
                    const reviewId = String(item.id || item.review_id)
                    if (!reviewId) continue

                    const orderId = item.order_id ? String(item.order_id) : null
                    const rating = item.ratings?.product_rating ? Number(item.ratings.product_rating) : 5
                    const reviewContent = item.review_content || ''
                    const replyContent = item.seller_reply || null
                    const initialReplyStatus = replyContent ? 'replied' : 'pending'
                    
                    const createTimeNum = item.create_time ? Number(item.create_time) : null
                    const submitTimeNum = item.submit_time ? Number(item.submit_time) : null
                    const finalTimeNum = createTimeNum || submitTimeNum || Date.now()
                    const createdAt = new Date(finalTimeNum).toISOString()

                    // Resolve item_id
                    const itemId = item.product_id ? String(item.product_id) : (item.item_id ? String(item.item_id) : itemIdMap.get(reviewId) || '')

                    // Resolve buyer name from daraz_orders
                    let buyerName = 'Buyer'
                    if (orderId) {
                        const { data: orderData } = await supabase
                            .from('daraz_orders')
                            .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                            .eq('order_id', orderId)
                            .maybeSingle()
                        if (orderData) {
                            buyerName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name} ${orderData.customer_last_name}`.trim() || 'Buyer'
                        }
                    }

                    // Get product metadata
                    let productName = 'Product'
                    let productImage = null

                    const darazProd = productDetailsMap.get(itemId)
                    if (darazProd && darazProd.name) {
                        productName = darazProd.name
                        productImage = darazProd.image || null
                    } else if (orderId) {
                        // Fallback: Resolve from daraz_orders items_detail
                        const { data: orderData } = await supabase
                            .from('daraz_orders')
                            .select('items_detail')
                            .eq('order_id', orderId)
                            .maybeSingle()
                        if (orderData && orderData.items_detail) {
                            const matchedItem = orderData.items_detail.find((it: any) => String(it.product_id || it.ProductId) === itemId)
                            if (matchedItem) {
                                productName = matchedItem.name || 'Product'
                                productImage = matchedItem.product_main_image || null
                            }
                        }
                    }

                    // Check if review already exists
                    const { data: existingReview } = await supabase
                        .from('daraz_reviews')
                        .select('review_id, reply_status, suggested_reply, suggested_reply_source')
                        .eq('review_id', reviewId)
                        .maybeSingle()

                    let suggestedReply = existingReview?.suggested_reply || null
                    let suggestedReplySource = existingReview?.suggested_reply_source || null

                    const upsertPayload = {
                        review_id: reviewId,
                        store_id: storeId,
                        order_id: orderId,
                        item_id: String(itemId),
                        product_name: productName,
                        product_image: productImage,
                        rating,
                        review_content: reviewContent,
                        buyer_name: buyerName,
                        reply_content: replyContent,
                        reply_status: existingReview?.reply_status === 'replied' ? 'replied' : initialReplyStatus,
                        suggested_reply: suggestedReply,
                        suggested_reply_source: suggestedReplySource,
                        created_at: createdAt,
                        synced_at: new Date().toISOString()
                    }

                    await supabase
                        .from('daraz_reviews')
                        .upsert(upsertPayload, { onConflict: 'review_id' })

                    reviewsSyncedCount++
                }
            } catch (batchErr: any) {
                console.error(`[ReviewSync] Error syncing review details batch:`, batchErr.message)
            }
        }

        revalidatePath('/dashboard/chat-ai/reviews')
        return { success: true, count: reviewsSyncedCount }
    } catch (err: any) {
        console.error(`[ReviewSync] Review sync process failed for store ${storeId}:`, err.message)
        return { success: false, error: err.message }
    }
}
