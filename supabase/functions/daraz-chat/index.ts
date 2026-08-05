import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 1. Deno Cryptographic Signature Verification
async function verifySignature(appKey: string, body: string, appSecret: string, receivedSignature: string): Promise<boolean> {
    const base = appKey + body;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(appSecret);
    
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(base)
    );
    
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    
    return expectedSignature === receivedSignature.toLowerCase();
}

// Helper: Sign Daraz API Requests
async function signRequest(apiName: string, params: Record<string, any>, appSecret: string): Promise<string> {
    const keys = Object.keys(params).sort();
    let str = apiName;
    keys.forEach(key => {
        str += key + String(params[key]);
    });
    
    const encoder = new TextEncoder();
    const keyData = encoder.encode(appSecret);
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(str)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Helper: Parse message text summary
function parseSummary(content: string): string {
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
            // Follow store invitation — cardType 10010 OR action key OR contains sellerId
            if (parsed.cardType === 10010 || parsed.cardType === '10010' ||
                parsed.action === 'followCard_follow' || parsed.sellerId) {
                return 'Follow Invitation';
            }
            if (parsed.cardType === 10007 || parsed.cardType === '10007' || parsed.orderId || parsed.order_id) {
                return 'Order Card';
            }
            if (parsed.cardType === 10006 || parsed.cardType === '10006' || parsed.itemId || parsed.item_id) {
                return 'Product Card';
            }
            if (parsed.cardType === 10008 || parsed.cardType === '10008' || parsed.promotionId || parsed.promotion_id) {
                return 'Voucher Card';
            }
            // Template 10015: welcome message with nested txt JSON
            if (parsed.txt) {
                const txtVal = parsed.txt;
                try {
                    const inner = JSON.parse(txtVal);
                    return inner.en || inner.ne || txtVal;
                } catch {
                    return typeof txtVal === 'string' ? txtVal.substring(0, 80) : content;
                }
            }
            return parsed.content || content;
        }
    } catch {
        // Not JSON
    }
    return content;
}

// Helper: Parse timestamp securely to milliseconds
function parseTimestamp(ts: string | number | undefined): string {
    if (!ts) return new Date().toISOString();
    const num = parseInt(String(ts));
    if (isNaN(num)) return new Date().toISOString();
    // If it is in seconds (10 digits), convert to milliseconds
    const ms = num < 9999999999 ? num * 1000 : num;
    return new Date(ms).toISOString();
}

// 2. Call Daraz API to Send Message
async function sendDarazMessage(
    storeId: string,
    sessionId: string,
    txt: string,
    supabase: any,
    appKey: string,
    appSecret: string
) {
    const { data: tokenData, error: tokenError } = await supabase
        .from('daraz_api_tokens')
        .select('access_token')
        .eq('store_id', storeId)
        .eq('app_type', 'chat')
        .maybeSingle();

    if (tokenError || !tokenData) {
        console.error(`[EdgeFunction] No active token found for store: ${storeId}`);
        return;
    }

    const accessToken = tokenData.access_token;
    const API_URL = 'https://api.daraz.com.np/rest';
    const timestamp = Date.now().toString();

    const params: Record<string, any> = {
        app_key: appKey,
        access_token: accessToken,
        timestamp,
        sign_method: 'sha256',
        session_id: sessionId,
        template_id: '1',
        txt: txt
    };

    const apiPath = '/im/message/send';
    params.sign = await signRequest(apiPath, params, appSecret);

    console.log(`[EdgeFunction] Sending auto-reply to Daraz session ${sessionId}...`);
    const queryStr = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}${apiPath}?${queryStr}`, {
        method: 'POST'
    });

    const resData = await response.json();
    if (resData.code !== "0" && resData.code !== 0) {
        console.error(`[EdgeFunction] Daraz Send API error:`, resData);
        return;
    }

    const messageId = resData.data?.message_id || `local_${Date.now()}`;

    // Get session's buyer_id
    const { data: session } = await supabase
        .from('daraz_chat_sessions')
        .select('buyer_id')
        .eq('session_id', sessionId)
        .maybeSingle();

    // Save sent message locally
    const msgPayload = {
        message_id: messageId,
        session_id: sessionId,
        from_account_id: 'seller',
        from_account_type: '2', // Seller
        to_account_id: session?.buyer_id || 'buyer',
        to_account_type: '1', // Buyer
        content: JSON.stringify({ txt }),
        template_id: '1',
        send_time: new Date().toISOString(),
        auto_reply: true,
        tags: []
    };

    await supabase.from('daraz_chat_messages').insert(msgPayload);

    // Update session summary
    await supabase
        .from('daraz_chat_sessions')
        .update({
            last_message_id: messageId,
            last_message_time: new Date().toISOString(),
            last_message_summary: txt
        })
        .eq('session_id', sessionId);

    console.log(`[EdgeFunction] Auto-reply message successfully sent and saved.`);
}

// 3. AI Reply Generation (OpenAI / Gemini API)
async function handleAiAutoReply(
    storeId: string,
    sessionId: string,
    userText: string,
    supabase: any,
    appKey: string,
    appSecret: string,
    geminiApiKey: string,
    settings: any
) {
    const aiProvider = settings?.ai_provider || 'gemini';
    console.log(`[EdgeFunction] Triggering AI auto-reply: "${userText}" (Provider: ${aiProvider})`);

    // Fetch active products context
    const { data: products } = await supabase
        .from('products')
        .select('product_name, seller_sku1, seller_sku2, is_deleted')
        .eq('is_deleted', false)
        .limit(15);

    let productsContext = 'Here is a list of some items we have in stock:\n';
    if (products && products.length > 0) {
        productsContext += products.map((p: any) => `- ${p.product_name} (SKU: ${p.seller_sku1 || 'N/A'})`).join('\n');
    } else {
        productsContext += 'No products inventory loaded.';
    }

    // Fetch recent message history
    const { data: recentMsgs } = await supabase
        .from('daraz_chat_messages')
        .select('from_account_type, content, send_time')
        .eq('session_id', sessionId)
        .order('send_time', { ascending: false })
        .limit(5);

    let historyContext = '';
    if (recentMsgs && recentMsgs.length > 0) {
        const sortedMsgs = [...recentMsgs].reverse();
        historyContext = sortedMsgs.map((m: any) => {
            let text = m.content;
            try {
                const p = JSON.parse(m.content);
                text = p.txt || m.content;
            } catch {}
            const sender = m.from_account_type === '2' ? 'Seller (You)' : 'Buyer (Customer)';
            return `[${sender}]: ${text}`;
        }).join('\n');
    }

    const systemPrompt = `You are an automated AI Customer Service Assistant for our online store on Daraz.
Your goal is to answer the customer's questions politely, accurately, and concisely. Keep responses short (under 2-3 sentences) because customers read them on mobile chat.

Store Inventory Context:
${productsContext}

Recent Conversation History:
${historyContext}
[Buyer (Customer)]: ${userText}

Generate a friendly response in English or Nepali based on the customer's language. Do not make up facts. If you do not know the answer (e.g. tracking code details not in context), politely tell the customer that a human support agent will review and reply shortly.
Response:`;

    let replyText = '';

    try {
        if (aiProvider === 'openai') {
            const openaiApiKey = settings?.openai_api_key;
            if (!openaiApiKey) {
                console.error('[EdgeFunction] OpenAI API Key is missing, falling back to Gemini.');
                throw new Error('OpenAI key missing');
            }
            const openaiModel = settings?.openai_model || 'gpt-4o-mini';
            console.log(`[EdgeFunction] Calling OpenAI API (${openaiModel})...`);
            const response = await fetch(
                'https://api.openai.com/v1/chat/completions',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${openaiApiKey}`
                    },
                    body: JSON.stringify({
                        model: openaiModel,
                        messages: [
                            { role: 'user', content: systemPrompt }
                        ],
                        temperature: 0.7
                    })
                }
            );

            const resData = await response.json();
            if (resData.error) {
                console.error('[EdgeFunction] OpenAI API Error:', resData.error);
                throw new Error(resData.error.message || 'OpenAI error');
            }
            replyText = resData?.choices?.[0]?.message?.content || '';
        } else {
            // Default/Fallback: Gemini
            if (!geminiApiKey) {
                console.error('[EdgeFunction] Gemini API Key is missing.');
                return;
            }
            console.log('[EdgeFunction] Calling Gemini API...');
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: systemPrompt }]
                        }]
                    })
                }
            );

            const resData = await response.json();
            replyText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }

        if (replyText && replyText.trim()) {
            const cleanReply = replyText.replace(/AI Assistant:/gi, '').trim();
            console.log(`[EdgeFunction] AI response generated: "${cleanReply}"`);
            await sendDarazMessage(storeId, sessionId, cleanReply, supabase, appKey, appSecret);
        }
    } catch (e) {
        console.error('[EdgeFunction] AI generation failed:', e);
        // Fallback to Gemini if OpenAI call failed and we have Gemini Key
        if (aiProvider === 'openai' && geminiApiKey) {
            console.log('[EdgeFunction] Attempting fallback to Gemini API after OpenAI failure...');
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{ text: systemPrompt }]
                            }]
                        })
                    }
                );

                const resData = await response.json();
                replyText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (replyText && replyText.trim()) {
                    const cleanReply = replyText.replace(/AI Assistant:/gi, '').trim();
                    console.log(`[EdgeFunction] AI fallback response generated: "${cleanReply}"`);
                    await sendDarazMessage(storeId, sessionId, cleanReply, supabase, appKey, appSecret);
                }
            } catch (geminiErr) {
                console.error('[EdgeFunction] Gemini fallback also failed:', geminiErr);
            }
        }
    }
}

// 4. Main Router Function
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text();
    const authorization = req.headers.get('authorization');

    // Handle empty test pings
    if (!rawBody || rawBody.trim() === '') {
        console.log('[EdgeFunction] Received empty body, acknowledging.');
        return new Response(JSON.stringify({ success: true, message: 'Empty body acknowledged' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    if (!authorization) {
        console.error('[EdgeFunction] Missing authorization signature header');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    const appKeyOrder = Deno.env.get('DARAZ_APP_KEY')?.trim() || '';
    const appSecretOrder = Deno.env.get('DARAZ_APP_SECRET')?.trim() || '';

    const appKeyChat = Deno.env.get('DARAZ_CHAT_APP_KEY')?.trim() || appKeyOrder;
    const appSecretChat = Deno.env.get('DARAZ_CHAT_APP_SECRET')?.trim() || appSecretOrder;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')?.trim() || '';

    // Maintain backwards compatibility for references to appKey and appSecret in this function
    const appKey = appKeyChat;
    const appSecret = appSecretChat;

    if (!appKeyOrder || !appSecretOrder) {
        console.error('[EdgeFunction] Environment credentials missing (DARAZ_APP_KEY / DARAZ_APP_SECRET)');
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Verify HMAC-SHA256 signature using both Order and Chat app credentials
    let isValid = false;
    let verifiedAppKey = '';

    if (appKeyOrder && appSecretOrder) {
        isValid = await verifySignature(appKeyOrder, rawBody, appSecretOrder, authorization || '');
        if (isValid) verifiedAppKey = appKeyOrder;
    }

    if (!isValid && appKeyChat && appSecretChat) {
        isValid = await verifySignature(appKeyChat, rawBody, appSecretChat, authorization || '');
        if (isValid) verifiedAppKey = appKeyChat;
    }

    if (!isValid) {
        console.error('[EdgeFunction] Invalid webhook signature (tried both Order and Chat credentials)');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[EdgeFunction] Signature verified successfully using App Key: ${verifiedAppKey}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = JSON.parse(rawBody);
    const { message_type, data, seller_id } = payload;

    // Map seller_id to database store_id
    const { data: store, error: storeError } = await supabase
        .from('online_stores')
        .select('id, seller_account')
        .eq('seller_id', String(seller_id))
        .maybeSingle();

    if (storeError || !store) {
        console.error(`[EdgeFunction] Store not found for seller_id: "${seller_id}"`);
        return new Response(JSON.stringify({ success: true, message: 'Store not found' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log(`[EdgeFunction] Matched Store: ${store.seller_account} (${store.id})`);

    // Fetch Chat Settings
    const { data: settings } = await supabase
        .from('daraz_chat_settings')
        .select('*')
        .eq('store_id', store.id)
        .maybeSingle();

    // We only process message_type 2 (Instant Messaging/Chat) here.
    // Non-messaging events (e.g. trade orders, returns) are routed to the Next.js backend.
    if (message_type !== 2 || !data) {
        const envAppUrl = Deno.env.get('NEXT_PUBLIC_APP_URL')?.trim() || Deno.env.get('APP_URL')?.trim();
        const dbAppUrl = settings?.app_url?.trim();
        const appUrl = envAppUrl || dbAppUrl || '';

        if (appUrl) {
            console.log(`[EdgeFunction] Routing non-messaging message_type: ${message_type} to Next.js backend at ${appUrl}/api/daraz/webhook...`);
            try {
                const response = await fetch(`${appUrl}/api/daraz/webhook`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'authorization': authorization || ''
                    },
                    body: rawBody
                });
                const resText = await response.text();
                console.log(`[EdgeFunction] Next.js backend response status: ${response.status}. Response: ${resText}`);
                return new Response(resText, {
                    status: response.status,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (routingErr) {
                console.error('[EdgeFunction] Failed routing to Next.js backend:', routingErr);
                return new Response(JSON.stringify({ error: 'Failed to route to backend', details: routingErr.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        } else {
            console.log(`[EdgeFunction] Ignoring message_type: ${message_type} (Next.js APP_URL is not configured in Supabase Secrets or Database settings)`);
            return new Response(JSON.stringify({ success: true, message: 'Non-messaging type ignored (APP_URL not configured)' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }

    if (settings && settings.messaging_enabled === false) {
        console.log(`[EdgeFunction] Messaging disabled for store: ${store.id}`);
        return new Response(JSON.stringify({ success: true, message: 'Store chat disabled' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    // Determine sender roles
    const fromAccountType = String(data.from_account_type); // '2' = seller, '1' = buyer
    const isBuyer = fromAccountType === '1' || fromAccountType === 'buyer';
    
    let buyerId = isBuyer ? String(data.from_account_id) : String(data.to_account_id);
    let sellerId = isBuyer ? String(data.to_account_id) : String(data.from_account_id);
    
    // Parse session_id for self-healing of buyerId and sellerId if they are undefined/wrong
    // Session format: {account_id}_{account_type}_{account_id}_{account_type}_{platform}
    // Example: 900151167013_2_900260032246_1_103 -> seller=900151167013, buyer=900260032246
    if (!buyerId || buyerId === 'undefined') {
        const parts = String(data.session_id || '').split('_');
        // Handle both 4-part and 5-part session IDs
        // Find the part with type '1' (buyer) 
        for (let pi = 0; pi < parts.length - 1; pi++) {
            if (parts[pi + 1] === '1') {
                buyerId = parts[pi];
            }
            if (parts[pi + 1] === '2') {
                sellerId = parts[pi];
            }
        }
    }

    // Retrieve or create session
    const { data: existingSession } = await supabase
        .from('daraz_chat_sessions')
        .select('title, unread_count, buyer_id')
        .eq('session_id', data.session_id)
        .maybeSingle();

    // Preserve existing good title — only re-resolve if currently generic/missing
    let sessionTitle = existingSession?.title || '';
    const isGenericTitle = !sessionTitle 
        || sessionTitle === 'undefined' 
        || sessionTitle === 'Buyer undefined' 
        || /^Buyer\s+\d+$/.test(sessionTitle)
        || sessionTitle.startsWith('Buyer ');
    
    // Use existing buyer_id from DB as fallback if current extraction failed
    const resolvedBuyerId = (buyerId && buyerId !== 'undefined') ? buyerId : (existingSession?.buyer_id || buyerId);
    
    if (isGenericTitle && resolvedBuyerId && resolvedBuyerId !== 'undefined') {
        // Attempt 1: contains() query with buyer_id as number
        const { data: orderData } = await supabase
            .from('daraz_orders')
            .select('customer_name, shipping_name, customer_first_name, customer_last_name')
            .contains('items_detail', JSON.stringify([{ buyer_id: Number(resolvedBuyerId) }]))
            .limit(1)
            .maybeSingle();

        if (orderData) {
            const resolvedName = orderData.customer_name || orderData.shipping_name || `${orderData.customer_first_name} ${orderData.customer_last_name}`.trim();
            if (resolvedName && resolvedName.trim()) {
                sessionTitle = resolvedName.trim();
            }
        }

        // Attempt 2: If still generic, try text search in items_detail JSON column
        if (!sessionTitle || isGenericTitle || /^Buyer\s+\d+$/.test(sessionTitle)) {
            const { data: orderData2 } = await supabase
                .from('daraz_orders')
                .select('customer_name, shipping_name')
                .filter('items_detail', 'cs', `[{"buyer_id":${resolvedBuyerId}}]`)
                .limit(1)
                .maybeSingle();
            if (orderData2) {
                const resolvedName2 = orderData2.customer_name || orderData2.shipping_name;
                if (resolvedName2 && resolvedName2.trim()) {
                    sessionTitle = resolvedName2.trim();
                }
            }
        }
    }

    if (!sessionTitle || sessionTitle === 'undefined' || sessionTitle.trim() === '') {
        sessionTitle = `Buyer ${resolvedBuyerId}`;
    }

    // Build upsert payload — only include title in update if it was improved (never downgrade good title to generic)
    const finalTitle = (existingSession?.title && !isGenericTitle) ? existingSession.title : sessionTitle;

    const sessionPayload = {
        session_id: data.session_id,
        store_id: store.id,
        buyer_id: resolvedBuyerId,
        title: finalTitle,
        unread_count: isBuyer ? (existingSession?.unread_count || 0) + 1 : 0,
        last_message_id: data.message_id,
        last_message_time: data.send_time ? parseTimestamp(data.send_time) : new Date().toISOString(),
        last_message_summary: data.content ? parseSummary(data.content) : null,
        updated_at: new Date().toISOString()
    };

    await supabase.from('daraz_chat_sessions').upsert(sessionPayload, { onConflict: 'session_id' });

    // Store Message details
    const msgPayload = {
        message_id: data.message_id,
        session_id: data.session_id,
        from_account_id: fromAccountType === '1' ? buyerId : sellerId,
        from_account_type: fromAccountType,
        to_account_id: fromAccountType === '1' ? sellerId : buyerId,
        to_account_type: String(data.to_account_type),
        content: data.content,
        template_id: String(data.template_id || '1'),
        send_time: data.send_time ? parseTimestamp(data.send_time) : new Date().toISOString(),
        auto_reply: false,
        tags: []
    };

    await supabase.from('daraz_chat_messages').upsert(msgPayload, { onConflict: 'message_id' });
    console.log(`[EdgeFunction] Saved incoming message: ${data.message_id}`);

    // If buyer sent the message, run automation check
    if (isBuyer) {
        const { data: rules } = await supabase
            .from('daraz_chat_rules')
            .select('*')
            .eq('store_id', store.id);

        let userText = '';
        try {
            const parsed = JSON.parse(data.content);
            userText = parsed.txt || parsed.content || data.content || '';
        } catch {
            userText = data.content || '';
        }
        const cleanText = userText.toLowerCase().trim();

        if (cleanText) {
            // A. Check exact matches
            const exactMatch = rules?.find(r => r.match_type === 'exact' && cleanText === r.pattern.toLowerCase().trim());
            if (exactMatch) {
                console.log(`[EdgeFunction] Exact keyword rule matched: "${userText}"`);
                await sendDarazMessage(store.id, data.session_id, exactMatch.reply_content, supabase, appKey, appSecret);
                return new Response(JSON.stringify({ success: true, message: 'Exact rule triggered' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // B. Check keyword sub-string matches
            const keywordMatch = rules?.find(r => r.match_type === 'keyword' && cleanText.includes(r.pattern.toLowerCase().trim()));
            if (keywordMatch) {
                console.log(`[EdgeFunction] Substring keyword rule matched: "${userText}"`);
                await sendDarazMessage(store.id, data.session_id, keywordMatch.reply_content, supabase, appKey, appSecret);
                return new Response(JSON.stringify({ success: true, message: 'Keyword rule triggered' }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // C. Check AI Auto-Reply
            if (settings?.ai_enabled) {
                const hasGemini = !!geminiApiKey;
                const hasOpenAi = settings?.ai_provider === 'openai' && !!settings?.openai_api_key;
                if (hasGemini || hasOpenAi) {
                    await handleAiAutoReply(store.id, data.session_id, userText, supabase, appKey, appSecret, geminiApiKey, settings);
                }
            }
        }
    }

    return new Response(JSON.stringify({ success: true, message: 'Webhook processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[EdgeFunction] Critical error handling request:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})

