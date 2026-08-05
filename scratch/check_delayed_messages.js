const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log("Querying daraz_delayed_messages records...");
    const { data: messages, error } = await supabase
        .from('daraz_delayed_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching messages:", error);
    } else {
        console.log("Recent Delayed Messages in Queue:");
        messages.forEach(m => {
            console.log(`ID: ${m.id} | Order: ${m.order_id} | Status: ${m.status} | Scheduled: ${m.scheduled_at} | Error: ${m.error_message || 'None'}`);
        });
    }
}

check();
