const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanPreviousPrices() {
    console.log("Cleaning bogus MRP previous_price values from daraz_competitor_products...");

    const { data: rows, error } = await supabase
        .from('daraz_competitor_products')
        .select('*');

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    console.log(`Found ${rows.length} competitor rows.`);

    for (const r of rows) {
        if (r.previous_price && r.current_price) {
            const pctDiff = Math.abs(r.previous_price - r.current_price) / r.previous_price;
            // If difference between previous_price and current_price is >= 20%, it was MRP vs Special price
            if (pctDiff >= 0.20) {
                console.log(`Clearing MRP previous_price (${r.previous_price}) for Comp ${r.competitor_index} (Product: ${r.product_id}). Current price: ${r.current_price}`);
                await supabase
                    .from('daraz_competitor_products')
                    .update({
                        previous_price: null,
                        price_changed_at: null
                    })
                    .eq('id', r.id);
            }
        }
    }

    console.log("Done cleaning previous_price entries!");
}

cleanPreviousPrices();
