const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://shblzjrzulnrsarfxptv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qyqpom8nR6W2Bbf27J8YMw_960ZP-U2';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDb() {
    const { data: orders, error: oError } = await supabase.from('daraz_orders_with_totals').select('*').limit(1);
    if (oError) console.error(oError);
    else console.log('ORDER_COLS:', Object.keys(orders[0]));
    console.log('ORDER_SAMPLE:', JSON.stringify(orders[0]));
}

checkDb();
