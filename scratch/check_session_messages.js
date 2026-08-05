const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    // Fetch session ID for buyer 900009123572
    const { data: session, error: sError } = await supabase
        .from('daraz_chat_sessions')
        .select('*')
        .eq('buyer_id', '900009123572')
        .maybeSingle();

    if (sError || !session) {
        console.error("Session not found or error:", sError);
        return;
    }

    console.log(`Found Session ID: ${session.session_id} for buyer Sabina Bhandari`);

    // Fetch messages for this session
    const { data: messages, error: mError } = await supabase
        .from('daraz_chat_messages')
        .select('*')
        .eq('session_id', session.session_id)
        .order('send_time', { ascending: true });

    if (mError) {
        console.error("Error fetching messages:", mError);
    } else {
        console.log("Messages in Session:");
        messages.forEach(m => {
            console.log(`Time: ${m.send_time} | Template: ${m.template_id} | Content: ${m.content} | AutoReply: ${m.auto_reply}`);
        });
    }
}

check();
