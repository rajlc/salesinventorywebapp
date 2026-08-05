// Fix existing daraz_chat_sessions where last_message_summary is still raw JSON
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

function parseSummary(content) {
    if (!content) return null;
    try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null) {
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
    } catch {}
    return content;
}

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get all sessions where last_message_summary starts with '{' (raw JSON)
    const { data: sessions, error } = await supabase
        .from('daraz_chat_sessions')
        .select('session_id, title, last_message_summary')
        .like('last_message_summary', '{%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${sessions.length} sessions with raw JSON summaries. Fixing...`);
    let fixed = 0;

    for (const s of sessions) {
        const resolved = parseSummary(s.last_message_summary);
        if (resolved !== s.last_message_summary) {
            const { error: upErr } = await supabase
                .from('daraz_chat_sessions')
                .update({ last_message_summary: resolved })
                .eq('session_id', s.session_id);
            
            if (!upErr) {
                console.log(`  ✅ "${s.title}": "${s.last_message_summary.substring(0, 40)}..." → "${resolved}"`);
                fixed++;
            }
        }
    }

    console.log(`\nDone! Fixed ${fixed} of ${sessions.length} sessions.`);
}

run();
