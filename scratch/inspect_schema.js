const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('--- Inspecting products ---');
    const { data: products, error: pErr } = await supabase.from('products').select('*').limit(1);
    if (pErr) console.error('products error:', pErr);
    else console.log('products columns:', Object.keys(products[0] || {}));

    console.log('--- Inspecting purchase_plans ---');
    const { data: plans, error: plErr } = await supabase.from('purchase_plans').select('*').limit(1);
    if (plErr) console.error('purchase_plans error:', plErr);
    else console.log('purchase_plans columns:', Object.keys(plans[0] || {}));

    console.log('--- Inspecting product_combos ---');
    const { data: combos, error: cErr } = await supabase.from('product_combos').select('*').limit(1);
    if (cErr) console.error('product_combos error:', cErr);
    else console.log('product_combos columns:', Object.keys(combos[0] || {}));

    // Check product types that actually exist
    console.log('--- Checking product types in DB ---');
    const { data: types, error: tErr } = await supabase.rpc('get_tables'); // Or just query some products
    const { data: sampleProducts, error: spErr } = await supabase.from('products').select('product_type, product_name').limit(10);
    if (spErr) console.error('sample products error:', spErr);
    else {
        console.log('Sample product types:', sampleProducts);
    }
}

run();
