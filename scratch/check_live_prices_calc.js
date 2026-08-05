const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch the 3 products using partial matching
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .or('product_name.ilike.%Weighing%,product_name.ilike.%Cooler Fan%,product_name.ilike.%Insect%');

    if (!products || products.length === 0) {
        console.log('No products found');
        return;
    }

    // 2. Fetch all live prices
    const { data: livePrices } = await supabase
        .from('daraz_live_prices')
        .select('*');

    const livePricesMap = new Map();
    livePrices.forEach(lp => {
        const sku = lp.seller_sku.toLowerCase().trim();
        const activePrice = lp.special_price !== null && lp.special_price > 0 ? lp.special_price : lp.price;
        if (!livePricesMap.has(sku)) {
            livePricesMap.set(sku, []);
        }
        livePricesMap.get(sku).push({
            store_name: lp.store_name,
            price: lp.price,
            special_price: lp.special_price,
            activePrice: activePrice
        });
    });

    products.forEach(p => {
        console.log('--------------------------------------------');
        console.log('Product:', p.product_name, 'ID:', p.id);
        const skus = [p.seller_sku1, p.seller_sku2, p.seller_sku3, p.seller_sku4].filter(Boolean);
        console.log('Skus Configured on Product:', skus);

        let lowestPrice = Infinity;
        skus.forEach(sku => {
            const lowerSku = sku.toLowerCase().trim();
            const matches = livePricesMap.get(lowerSku) || [];
            console.log(`  SKU: ${sku} -> Matches in daraz_live_prices:`, matches);
            matches.forEach(m => {
                if (m.activePrice > 0 && m.activePrice < lowestPrice) {
                    lowestPrice = m.activePrice;
                }
            });
        });

        console.log('Lowest Price calculated:', lowestPrice);
        if (lowestPrice !== Infinity) {
            const disc = lowestPrice * 0.95;
            console.log('Discounted (5%):', disc, 'Rounded:', Math.round(disc / 5) * 5);
        }
    });
}
run();
