const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let allFeeNames = new Set();
    let allTypes = new Set();
    let page = 0;
    const limit = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('daraz_finance_transactions')
            .select('fee_name, transaction_type')
            .range(page * limit, (page + 1) * limit - 1);

        if (error) {
            console.error('Error fetching transactions:', error.message);
            break;
        }
        if (!data || data.length === 0) break;

        data.forEach(t => {
            if (t.fee_name) allFeeNames.add(t.fee_name);
            if (t.transaction_type) allTypes.add(t.transaction_type);
        });

        if (data.length < limit) break;
        page++;
    }

    console.log('Total Unique Fee Names Found:', allFeeNames.size);
    console.log('List of Unique Fee Names:', Array.from(allFeeNames));
    console.log('List of Unique Transaction Types:', Array.from(allTypes));
}

check();
