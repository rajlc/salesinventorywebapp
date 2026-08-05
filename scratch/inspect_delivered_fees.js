const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('daraz_finance_transactions')
        .select('*')
        .eq('transaction_type', 'Delivered Orders-Transaction Fees')
        .limit(10);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('Delivered Orders-Transaction Fees samples:', data);
}

check();
