const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if mapping for 'Bracelets' exists
    const { data: mappings } = await supabase
        .from('daraz_website_category_mappings')
        .select('*')
        .ilike('daraz_category', 'Bracelets');
    console.log('Bracelets mapping in DB:', mappings);

    // 2. Find the product and check its fields
    const { data: products } = await supabase
        .from('products')
        .select('product_name, category_name, website_category')
        .ilike('product_name', '%12 Constellation Zodiac%');
    console.log('Matching Products in DB:', products);
}

check();
