const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch 20 messages where from_account_id is NOT 'undefined'
    const { data: validMsgs, error: err1 } = await supabase
        .from('daraz_chat_messages')
        .select('*')
        .neq('from_account_id', 'undefined')
        .limit(10);

    if (err1) {
        console.error('Error fetching valid messages:', err1);
    } else {
        console.log(`Found ${validMsgs.length} messages with valid from_account_id:`);
        console.table(validMsgs.map(m => ({
            message_id: m.message_id,
            from_account_id: m.from_account_id,
            from_account_type: m.from_account_type,
            content: m.content.substring(0, 50),
            send_time: m.send_time
        })));
    }

    // Fetch 20 messages where from_account_id IS 'undefined'
    const { data: undefMsgs, error: err2 } = await supabase
        .from('daraz_chat_messages')
        .select('*')
        .eq('from_account_id', 'undefined')
        .limit(10);

    if (err2) {
        console.error('Error fetching undefined messages:', err2);
    } else {
        console.log(`Found ${undefMsgs.length} messages with undefined from_account_id:`);
        console.table(undefMsgs.map(m => ({
            message_id: m.message_id,
            from_account_type: m.from_account_type,
            content: m.content.substring(0, 50),
            send_time: m.send_time
        })));
    }
}

run();
