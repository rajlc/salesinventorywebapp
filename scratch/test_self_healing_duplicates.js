const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

async function run() {
    console.log('--- DUPLICATE ACTIVE PLANS SEARCH ---');
    // Fetch all active plans (Pending or Pending Confirmation)
    const { data: plans, error } = await supabase
        .from('purchase_plans')
        .select('id, product_id, status, quantity, remarks, product:products(product_name)')
        .in('status', ['Pending', 'Pending Confirmation']);

    if (error) {
        console.error('Error fetching plans:', error.message);
        return;
    }

    console.log(`Found ${plans.length} total active plans.`);

    // Group by product_id
    const grouped = {};
    for (const plan of plans) {
        if (!grouped[plan.product_id]) {
            grouped[plan.product_id] = [];
        }
        grouped[plan.product_id].push(plan);
    }

    // Find duplicates
    const duplicates = Object.entries(grouped).filter(([_, items]) => items.length > 1);

    if (duplicates.length === 0) {
        console.log('No duplicate active plans found in the database!');
        return;
    }

    console.log(`\nFound ${duplicates.length} products with duplicate plans:`);
    for (const [productId, items] of duplicates) {
        const name = items[0].product?.product_name || 'Unknown Product';
        console.log(`\nProduct: "${name}" (ID: ${productId}) has ${items.length} active plans:`);
        items.forEach((item, idx) => {
            console.log(`  [${idx + 1}] ID: ${item.id} | Status: ${item.status} | Qty: ${item.quantity} | Remarks: "${item.remarks}"`);
        });

        // Let's run a dry run self-healing on this product
        console.log(`\nSimulating self-healing for product: "${name}"`);
        const extraPlanIds = items.slice(1).map(p => p.id);
        console.log(`-> Oldest plan (to KEEP): ID ${items[0].id}`);
        console.log(`-> Extra duplicate plans (to DELETE):`, extraPlanIds);

        // Perform actual cleanup if requested via argument
        if (process.argv.includes('--clean')) {
            console.log('Cleaning up duplicates in database...');
            const { error: delErr } = await supabase
                .from('purchase_plans')
                .delete()
                .in('id', extraPlanIds);
            if (delErr) {
                console.error('Error deleting duplicates:', delErr.message);
            } else {
                console.log('✅ Successfully deleted duplicates!');
            }
        } else {
            console.log('Run with --clean to delete duplicates: node scratch/test_self_healing_duplicates.js --clean');
        }
    }
}

run().catch(console.error);
