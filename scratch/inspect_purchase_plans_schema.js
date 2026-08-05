const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'purchase_plans' });
    if (error) {
        // Fallback: query from information_schema via standard query if RPC doesn't exist
        const { data: cols, error: err } = await supabase
            .from('purchase_plans')
            .select('*')
            .limit(1);
        if (err) {
            console.error(err);
        } else {
            console.log('Columns: ', Object.keys(cols[0] || {}));
        }
    } else {
        console.log(data);
    }
}
run();
