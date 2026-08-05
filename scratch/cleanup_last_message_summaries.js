const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

function parseSummary(content) {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
            if (parsed.cardType === 10010 || parsed.cardType === '10010' || parsed.action === 'followCard_follow') {
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
            return parsed.txt || parsed.content || content;
        }
    } catch {
        // Not JSON
    }
    return content;
}

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching all chat sessions from database...');
    const { data: sessions, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('session_id, last_message_summary');

    if (sessErr) {
        console.error('Error fetching sessions:', sessErr);
        return;
    }

    console.log(`Retrieved ${sessions.length} sessions. Scanning summaries...`);

    let updatedCount = 0;

    for (const session of sessions) {
        const rawSummary = session.last_message_summary;
        if (!rawSummary) continue;

        const cleanedSummary = parseSummary(rawSummary);
        if (cleanedSummary !== rawSummary) {
            console.log(`[Summary-Cleanup] Session ${session.session_id}: '${rawSummary.substring(0, 50)}...' -> '${cleanedSummary}'`);
            
            const { error: updateErr } = await supabase
                .from('daraz_chat_sessions')
                .update({
                    last_message_summary: cleanedSummary,
                    updated_at: new Date().toISOString()
                })
                .eq('session_id', session.session_id);

            if (updateErr) {
                console.error(`Error updating session ${session.session_id}:`, updateErr.message);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`\nDone. Cleaned and updated ${updatedCount} session summaries.`);
}

run();
