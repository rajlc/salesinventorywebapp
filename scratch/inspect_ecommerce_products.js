const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
        .from('ecommerce_products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching ecommerce product:', error);
    } else if (data && data.length > 0) {
        console.log('Columns in ecommerce_products table:', Object.keys(data[0]));
        console.log('Sample Row:', data[0]);
    } else {
        console.log('No ecommerce products found.');
    }
}

run();
