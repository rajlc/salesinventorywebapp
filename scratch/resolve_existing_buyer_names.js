const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching all chat sessions from database...');
    const { data: sessions, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('*');

    if (sessErr) {
        console.error('Error fetching sessions:', sessErr);
        return;
    }

    console.log(`Retrieved ${sessions.length} sessions. Starting clean up...`);

    let selfHealedCount = 0;
    let nameResolvedCount = 0;
    let updatedSessionsCount = 0;

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        let buyerId = session.buyer_id;
        let title = session.title;
        let needsUpdate = false;

        // 1. Self-heal buyer_id if missing or 'undefined'
        if (!buyerId || buyerId === 'undefined') {
            const parts = session.session_id.split('_');
            if (parts.length >= 4) {
                if (parts[1] === '1') buyerId = parts[0];
                else if (parts[3] === '1') buyerId = parts[2];
            }

            if (buyerId && buyerId !== 'undefined') {
                console.log(`[Self-Heal] Fixed buyer_id for session ${session.session_id}: '${session.buyer_id}' -> '${buyerId}'`);
                selfHealedCount++;
                needsUpdate = true;
            }
        }

        // 2. Resolve name if title is generic
        const isGenericTitle = !title || title === 'undefined' || title === 'Buyer undefined' || title.startsWith('Buyer ');
        if (isGenericTitle && buyerId && buyerId !== 'undefined') {
            const { data: matchedOrders, error: orderErr } = await supabase
                .from('daraz_orders')
                .select('customer_name, shipping_name, customer_first_name, customer_last_name')
                .contains('items_detail', JSON.stringify([{ buyer_id: Number(buyerId) }]))
                .limit(1);

            if (orderErr) {
                console.error(`Error querying orders for buyer ${buyerId}:`, orderErr.message);
            } else if (matchedOrders && matchedOrders.length > 0) {
                const order = matchedOrders[0];
                const resolvedName = order.customer_name || order.shipping_name || `${order.customer_first_name} ${order.customer_last_name}`.trim();
                if (resolvedName && resolvedName !== title) {
                    console.log(`[Resolve-Name] Resolved title for buyer ${buyerId}: '${title}' -> '${resolvedName}'`);
                    title = resolvedName;
                    nameResolvedCount++;
                    needsUpdate = true;
                }
            }
        }

        // 3. Update the database record if changes were made
        if (needsUpdate) {
            const { error: updateErr } = await supabase
                .from('daraz_chat_sessions')
                .update({
                    buyer_id: buyerId,
                    title: title,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', session.session_id);

            if (updateErr) {
                console.error(`Error updating session ${session.session_id}:`, updateErr.message);
            } else {
                updatedSessionsCount++;
            }
        }
    }

    console.log('\n--- Migration Summary ---');
    console.log(`Total sessions scanned: ${sessions.length}`);
    console.log(`Buyer IDs self-healed: ${selfHealedCount}`);
    console.log(`Names resolved from orders: ${nameResolvedCount}`);
    console.log(`Total database sessions updated: ${updatedSessionsCount}`);
}

run();
