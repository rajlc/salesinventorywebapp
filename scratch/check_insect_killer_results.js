const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: prods } = await supabase
        .from('products')
        .select('product_name, commission_percent')
        .ilike('product_name', '%Insect%')
        .limit(1);

    if (prods && prods[0]) {
        console.log('Result:', prods[0].product_name, 'Commission:', prods[0].commission_percent);
    } else {
        console.log('Product not found.');
    }
}
run();
