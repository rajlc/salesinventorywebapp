const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const { data: plans, error } = await supabase
        .from('purchase_plans')
        .select('id, status, expires_at, quantity, remarks')
        .in('status', ['Pending', 'Pending Confirmation']);

    if (error) {
        console.error(error);
        return;
    }
    console.log(plans);
}
run();
