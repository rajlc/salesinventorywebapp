const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
        .from('daraz_reviews')
        .select('review_id, review_content, reply_status, buyer_name, product_name')
        .neq('review_content', '')
        .neq('reply_status', 'replied');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} pending/failed reviews with comments:`);
    console.log(data);
}

run();
