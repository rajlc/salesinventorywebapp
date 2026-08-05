const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://shblzjrzulnrsarfxptv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qyqpom8nR6W2Bbf27J8YMw_960ZP-U2';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase.from('daraz_orders_with_totals').select('*').limit(1);
    if (error) console.error(error);
    else {
        console.log('Columns:', Object.keys(data[0]));
        console.log('Sample data:', JSON.stringify(data[0], null, 2));
    }
}

checkColumns();
