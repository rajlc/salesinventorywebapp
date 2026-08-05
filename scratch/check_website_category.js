const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function check() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if daraz_website_category_mappings table has mappings
    const { data: mappings, error: mappingError } = await supabase
        .from('daraz_website_category_mappings')
        .select('*')
        .limit(5);

    if (mappingError) {
        console.error('Error fetching mappings:', mappingError.message);
    } else {
        console.log(`Found ${mappings.length} sample mappings in daraz_website_category_mappings:`, mappings);
    }

    // 2. Check columns in products table
    const { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (productError) {
        console.error('Error fetching sample product:', productError.message);
    } else if (products && products.length > 0) {
        const prod = products[0];
        console.log('Columns in products table:', Object.keys(prod));
        console.log('Sample product website_category:', prod.website_category);
        console.log('Sample product category_name:', prod.category_name);
    } else {
        console.log('No products found in database.');
    }

    // 3. Count products with non-null website_category
    const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('website_category', 'is', null);

    if (countError) {
        console.error('Error counting mapped products:', countError.message);
    } else {
        console.log(`Number of products with non-null website_category: ${count}`);
    }
}

check();
