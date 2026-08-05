const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('daraz_finance_transactions')
        .select('fee_name, transaction_type')
        .limit(500);

    if (error) {
        console.error('Error fetching transactions:', error.message);
        return;
    }

    const uniqueFeeNames = Array.from(new Set(data.map(t => t.fee_name).filter(Boolean)));
    const uniqueTypes = Array.from(new Set(data.map(t => t.transaction_type).filter(Boolean)));
    console.log('Unique Fee Names in DB:', uniqueFeeNames);
    console.log('Unique Transaction Types in DB:', uniqueTypes);
}

check();
