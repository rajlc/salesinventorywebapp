const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    const sessionId = '900152202035_2_900324496704_1_103';

    const { data: session, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

    if (sessErr) {
        console.error('Error fetching session:', sessErr);
        return;
    }

    console.log('Session Details:', session);

    const { data: messages, error: msgErr } = await supabase
        .from('daraz_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('send_time', { ascending: true });

    if (msgErr) {
        console.error('Error fetching messages:', msgErr);
        return;
    }

    console.log(`\nMessages in Session (${messages.length}):`);
    console.table(messages.map(m => ({
        message_id: m.message_id,
        from_id: m.from_account_id,
        from_type: m.from_account_type,
        to_id: m.to_account_id,
        to_type: m.to_account_type,
        content: m.content.substring(0, 100),
        send_time: m.send_time
    })));
}

run();
