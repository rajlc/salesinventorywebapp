const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function run() {
    console.log('Updating all products website_sync_status to Pending in Supabase...');
    const { data, error } = await supabase
        .from('products')
        .update({ website_sync_status: 'Pending' })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // safe check to update all rows

    if (error) {
        console.error('Error updating products:', error);
    } else {
        console.log('Successfully updated products website_sync_status to Pending.');
    }
}

run().catch(console.error);
