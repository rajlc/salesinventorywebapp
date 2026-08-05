const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function sync() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching active products...');
    const { data: activeProductsData, error: prodErr } = await supabase
        .from('products')
        .select('category_name')
        .not('category_name', 'is', null);

    if (prodErr) {
        console.error('Error fetching products:', prodErr.message);
        return;
    }

    // Get unique category names present in products
    const uniqueActiveCats = Array.from(
        new Set(activeProductsData.map(p => String(p.category_name).trim()))
    );
    console.log(`Found ${uniqueActiveCats.length} unique active categories in products:`, uniqueActiveCats);

    // Fetch mappings matching these active categories
    const { data: activeMappings, error: mapErr } = await supabase
        .from('daraz_website_category_mappings')
        .select('daraz_category, website_category')
        .in('daraz_category', uniqueActiveCats);

    if (mapErr) {
        console.error('Error fetching mappings:', mapErr.message);
        return;
    }

    console.log(`Found ${activeMappings.length} mappings that match active categories. Updating products...`);
    let updatedCount = 0;

    for (const mapping of activeMappings) {
        const { data, error } = await supabase
            .from('products')
            .update({ website_category: mapping.website_category })
            .ilike('category_name', mapping.daraz_category)
            .select('id');

        if (error) {
            console.error(`Failed to update products for category "${mapping.daraz_category}":`, error.message);
        } else {
            console.log(`Updated category "${mapping.daraz_category}" -> "${mapping.website_category}" (${data ? data.length : 0} products)`);
            updatedCount += (data ? data.length : 0);
        }
    }

    console.log(`Completed. Total updated products: ${updatedCount}`);
}

sync();
