// Inspect actual message content of sessions showing JSON in sidebar
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find sessions whose last_message_summary looks like raw JSON
    const { data: sessions } = await supabase
        .from('daraz_chat_sessions')
        .select('session_id, title, last_message_summary')
        .like('last_message_summary', '{%')
        .limit(10);

    console.log(`Sessions with raw JSON as last_message_summary:\n`);
    for (const s of (sessions || [])) {
        console.log(`Title: ${s.title}`);
        console.log(`Summary: ${s.last_message_summary}`);
        
        // Also get the actual message content from DB
        const { data: msg } = await supabase
            .from('daraz_chat_messages')
            .select('message_id, content, template_id, from_account_type')
            .eq('session_id', s.session_id)
            .order('send_time', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (msg) {
            console.log(`  Last msg content: ${msg.content}`);
            console.log(`  template_id: ${msg.template_id}`);
        }
        console.log();
    }
}

run();
