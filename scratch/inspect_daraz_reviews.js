const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.from('daraz_reviews').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching reviews:', error);
        return;
    }
    console.log(`Total reviews in DB: ${data.length}`);
    if (data.length > 0) {
        console.log('Sample reviews:', data.slice(0, 5));
    }
}

run();
