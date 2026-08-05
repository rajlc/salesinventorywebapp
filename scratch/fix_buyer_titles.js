// Fix all existing sessions with "Buyer [number]" titles by resolving real customer names from orders
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all sessions with generic "Buyer..." titles
    const { data: sessions, error } = await supabase
        .from('daraz_chat_sessions')
        .select('session_id, buyer_id, title')
        .or('title.like.Buyer %,title.is.null,title.eq.undefined');

    if (error) {
        console.error('Error fetching sessions:', error);
        return;
    }
    
    console.log(`Found ${sessions.length} sessions with generic "Buyer" titles. Fixing...`);
    let fixed = 0;
    let skipped = 0;

    for (const session of sessions) {
        // Extract buyer_id from session - try DB first, then parse from session_id
        let buyerId = session.buyer_id;
        
        if (!buyerId || buyerId === 'undefined') {
            // Parse from session_id: format is {id}_{type}_{id}_{type}_{platform}
            const parts = String(session.session_id || '').split('_');
            for (let pi = 0; pi < parts.length - 1; pi++) {
                if (parts[pi + 1] === '1') {
                    buyerId = parts[pi];
                    break;
                }
            }
        }

        if (!buyerId || buyerId === 'undefined') {
            console.log(`  ⚠ Session ${session.session_id}: Cannot determine buyer_id, skipping.`);
            skipped++;
            continue;
        }

        // Look up real name from orders
        let resolvedName = null;

        // Attempt 1: contains query
        const { data: orderData } = await supabase
            .from('daraz_orders')
            .select('customer_name, shipping_name')
            .contains('items_detail', JSON.stringify([{ buyer_id: Number(buyerId) }]))
            .limit(1)
            .maybeSingle();
        
        if (orderData) {
            resolvedName = orderData.customer_name || orderData.shipping_name;
        }

        // Attempt 2: filter cs
        if (!resolvedName) {
            const { data: orderData2 } = await supabase
                .from('daraz_orders')
                .select('customer_name, shipping_name')
                .filter('items_detail', 'cs', `[{"buyer_id":${buyerId}}]`)
                .limit(1)
                .maybeSingle();
            if (orderData2) {
                resolvedName = orderData2.customer_name || orderData2.shipping_name;
            }
        }

        if (resolvedName && resolvedName.trim()) {
            const { error: updateError } = await supabase
                .from('daraz_chat_sessions')
                .update({ 
                    title: resolvedName.trim(),
                    buyer_id: String(buyerId)
                })
                .eq('session_id', session.session_id);
            
            if (updateError) {
                console.error(`  ❌ Failed to update ${session.session_id}:`, updateError.message);
            } else {
                console.log(`  ✅ ${session.session_id}: "${session.title}" → "${resolvedName.trim()}"`);
                fixed++;
            }
        } else {
            // At least fix the buyer_id if we found it
            if (buyerId && buyerId !== session.buyer_id) {
                await supabase
                    .from('daraz_chat_sessions')
                    .update({ buyer_id: String(buyerId) })
                    .eq('session_id', session.session_id);
            }
            console.log(`  ⚠ Session ${session.session_id} (buyer_id: ${buyerId}): No order found, keeping "${session.title}"`);
            skipped++;
        }
    }
    
    console.log(`\nDone! Fixed: ${fixed}, Skipped: ${skipped}`);
}

run();
